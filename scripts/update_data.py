"""Fetch official monthly BLS observations; publish only a complete, valid snapshot.

No dependencies or credentials. Failed fetches leave last-good observations intact.
"""
from __future__ import annotations

import argparse
import calendar
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
START = 2007
SERIES = {
    "cpi": {"id": "CUUR0000SA0", "name": "Consumer prices", "unit": "Index, 1982–84 = 100", "adjustment": "Not seasonally adjusted"},
    "cpiAdjusted": {"id": "CUSR0000SA0", "name": "Consumer prices, adjusted", "unit": "Index, 1982–84 = 100", "adjustment": "Seasonally adjusted"},
    "earnings": {"id": "CES0500000003", "name": "Average hourly earnings, all private employees", "unit": "Dollars per hour", "adjustment": "Seasonally adjusted"},
    "unemployment": {"id": "LNS14000000", "name": "Unemployment rate", "unit": "Percent", "adjustment": "Seasonally adjusted"},
    "food": {"id": "CUUR0000SAF11", "name": "Food at home", "unit": "Index, 1982–84 = 100", "adjustment": "Not seasonally adjusted"},
    "shelter": {"id": "CUUR0000SAH1", "name": "Shelter", "unit": "Index, 1982–84 = 100", "adjustment": "Not seasonally adjusted"},
    "gas": {"id": "CUUR0000SETB01", "name": "Gasoline, all types", "unit": "Index, 1982–84 = 100", "adjustment": "Not seasonally adjusted"},
}


def parse_response(payload, expected):
    if payload.get("status") != "REQUEST_SUCCEEDED":
        raise ValueError("BLS did not return a successful response: " + str(payload.get("message", [])))
    result = {}
    for series in payload.get("Results", {}).get("series", []):
        sid = series.get("seriesID")
        if sid not in expected or sid in result:
            raise ValueError("Unexpected or duplicate BLS series")
        points = {}
        for row in series.get("data", []):
            period, year = row.get("period", ""), row.get("year", "")
            if period == "M13":
                continue  # Annual averages must never masquerade as months.
            if not re.fullmatch(r"M(0[1-9]|1[0-2])", period) or not re.fullmatch(r"\d{4}", year):
                raise ValueError("Invalid observation date")
            key = year + "-" + period[1:]
            if key in points:
                raise ValueError("Duplicate observation month")
            raw = str(row.get("value", "")).strip()
            value = None if raw in {"-", "", "(S)"} else float(raw.replace(",", ""))
            if value is not None and (not math.isfinite(value) or value < 0 or (value == 0 and sid != "LNS14000000")):
                raise ValueError("Invalid numeric observation")
            if sid == "LNS14000000" and value is not None and value > 100:
                raise ValueError("Invalid unemployment rate")
            notes = [x["text"] for x in row.get("footnotes", []) if x.get("text")]
            points[key] = {"date": key, "value": value, "notes": notes}
        if sum(p["value"] is not None for p in points.values()) < 12:
            raise ValueError("Insufficient BLS observations")
        result[sid] = points
    if set(result) != set(expected):
        raise ValueError("BLS response omitted a required series")
    return result


def fetch(start, end):
    body = json.dumps({"seriesid": [s["id"] for s in SERIES.values()], "startyear": str(start), "endyear": str(end)}).encode()
    for attempt in range(3):
        try:
            request = urllib.request.Request(API, body, {"Content-Type": "application/json", "User-Agent": "PurchasingPower/1.0 (public economic data dashboard)"})
            with urllib.request.urlopen(request, timeout=35) as response:
                raw = response.read(5_000_001)
                if len(raw) > 5_000_000:
                    raise ValueError("Oversized BLS response")
                return parse_response(json.loads(raw), [s["id"] for s in SERIES.values()])
        except (OSError, ValueError) as error:
            if attempt == 2:
                raise error
            time.sleep(attempt + 1)


def assemble(chunks, now):
    merged = {key: {} for key in SERIES}
    for chunk in chunks:
        for key, meta in SERIES.items():
            for month, point in chunk[meta["id"]].items():
                if month in merged[key] and merged[key][month] != point:
                    raise ValueError("Conflicting overlapping observations")
                if month > now.strftime("%Y-%m"):
                    raise ValueError("Future observation returned")
                merged[key][month] = point
    output = {}
    for key, meta in SERIES.items():
        points = sorted(merged[key].values(), key=lambda p: p["date"])
        valid = [p for p in points if p["value"] is not None]
        if len(valid) < 24:
            raise ValueError("Snapshot must include at least 24 valid months per series")
        latest = valid[-1]["date"]
        if (now.year * 12 + now.month) - (int(latest[:4]) * 12 + int(latest[5:])) > 6:
            raise ValueError("BLS response is unexpectedly old; retaining last-good data")
        output[key] = {**meta, "source": "https://data.bls.gov/timeseries/" + meta["id"], "latest": latest, "data": points}
    return {"schemaVersion": 1, "retrievedAt": now.isoformat(timespec="seconds"), "source": API, "series": output}


def digest(snapshot):
    return hashlib.sha256(json.dumps(snapshot["series"], sort_keys=True).encode()).hexdigest()


def write_atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(content)
            handle.flush()
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    temporary.replace(path)


def publish(snapshot, directory=ROOT, now=None):
    now = now or datetime.now(timezone.utc)
    path = directory / "data" / "snapshot.json"
    old = json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
    # Reject silent truncation, including a successful API response with short history.
    if old:
        for key in SERIES:
            before = {p["date"] for p in old["series"][key]["data"]}
            after = {p["date"] for p in snapshot["series"][key]["data"]}
            if not before.issubset(after):
                raise ValueError("New snapshot dropped existing observation months")
            if snapshot["series"][key]["latest"] < old["series"][key]["latest"]:
                raise ValueError("New snapshot moved a series backwards")
    changed = not old or digest(snapshot) != digest(old)
    if not changed:
        snapshot = old
    text = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
    write_atomic(path, text + "\n")
    write_atomic(directory / "data.js", "// Official BLS snapshot. Generated by scripts/update_data.py.\nwindow.PP_DATA = " + text + ";\n")
    status = {"lastAttempt": now.isoformat(timespec="seconds"), "lastSuccess": now.isoformat(timespec="seconds"), "ok": True, "dataChanged": changed, "dataRetrievedAt": snapshot["retrievedAt"]}
    write_atomic(directory / "status.json", json.dumps(status, indent=2) + "\n")
    write_atomic(directory / "status.js", "window.PP_STATUS = " + json.dumps(status) + ";\n")
    return changed


def mark_failure(directory, now):
    path = directory / "status.json"
    previous = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    status = {**previous, "lastAttempt": now.isoformat(timespec="seconds"), "ok": False, "error": "The latest BLS update failed validation or could not be fetched. The previous valid snapshot is still available."}
    write_atomic(path, json.dumps(status, indent=2) + "\n")
    write_atomic(directory / "status.js", "window.PP_STATUS = " + json.dumps(status) + ";\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    try:
        chunks = [fetch(year, min(year + 9, now.year)) for year in range(START, now.year + 1, 10)]
        snapshot = assemble(chunks, now)
        changed = publish(snapshot, args.output, now)
        print("Published new official observations." if changed else "BLS checked successfully; observations unchanged.")
        print("Latest months: " + ", ".join(k + " " + s["latest"] for k, s in snapshot["series"].items()))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        mark_failure(args.output, now)
        print("Update failed; previous snapshot retained: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
