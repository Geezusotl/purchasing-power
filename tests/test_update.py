import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import update_data as updater

NOW = datetime(2026, 10, 20, tzinfo=timezone.utc)


def response():
    return {"status": "REQUEST_SUCCEEDED", "Results": {"series": [
        {"seriesID": meta["id"], "data": [
            {"year": str(year), "period": f"M{month:02}", "value": str(4.2 if key == "unemployment" else 100 + (year-2023)*12+month), "footnotes": [{"code": "P", "text": "preliminary"}]}
            for year in range(2023, 2027) for month in range(1, 13) if (year, month) <= (2026, 9)
        ]} for key, meta in updater.SERIES.items()
    ]}}


def snapshot():
    return updater.assemble([updater.parse_response(response(), [s["id"] for s in updater.SERIES.values()])], NOW)


class DataTests(unittest.TestCase):
    def parse(self, body):
        return updater.parse_response(body, [s["id"] for s in updater.SERIES.values()])

    def test_missing_observation_is_null(self):
        body = response(); body['Results']['series'][0]['data'][0]['value'] = '-'
        result = self.parse(body)
        self.assertIsNone(result['CUUR0000SA0']['2023-01']['value'])

    def test_provider_failure_is_not_success(self):
        body = response(); body['status'] = 'REQUEST_FAILED'
        with self.assertRaises(ValueError): self.parse(body)

    def test_missing_series_rejected(self):
        body = response(); body['Results']['series'].pop()
        with self.assertRaises(ValueError): self.parse(body)

    def test_partial_response_rejected(self):
        body = response(); body['Results']['series'][0]['data'] = body['Results']['series'][0]['data'][:4]
        with self.assertRaises(ValueError): self.parse(body)

    def test_duplicate_month_rejected(self):
        body = response(); series = body['Results']['series'][0]; series['data'].append(series['data'][0])
        with self.assertRaises(ValueError): self.parse(body)

    def test_nonfinite_and_negative_rejected(self):
        for value in ['NaN', 'Infinity', '-4', '0']:
            with self.subTest(value=value):
                body = response(); body['Results']['series'][0]['data'][0]['value'] = value
                with self.assertRaises(ValueError): self.parse(body)

    def test_unemployment_bounds(self):
        body = response(); body['Results']['series'][3]['data'][0]['value'] = '101'
        with self.assertRaises(ValueError): self.parse(body)

    def test_annual_average_ignored(self):
        body = response(); body['Results']['series'][0]['data'].append({'year':'2025','period':'M13','value':'999'})
        self.assertEqual(len(self.parse(body)['CUUR0000SA0']),45)

    def test_notes_retained(self):
        self.assertEqual(snapshot()['series']['earnings']['data'][0]['notes'], ['preliminary'])

    def test_future_month_rejected(self):
        parsed = self.parse(response()); parsed['CUUR0000SA0']['2027-01'] = {'date':'2027-01','value':200,'notes':[]}
        with self.assertRaises(ValueError): updater.assemble([parsed],NOW)

    def test_old_response_rejected(self):
        with self.assertRaises(ValueError): updater.assemble([self.parse(response())],datetime(2028,1,1,tzinfo=timezone.utc))

    def test_snapshot_and_browser_data_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); updater.publish(snapshot(),root,NOW)
            serialized = root.joinpath('data.js').read_text(encoding='utf-8').split('window.PP_DATA = ')[1].removesuffix(';\n')
            self.assertEqual(json.loads(serialized),json.loads(root.joinpath('data/snapshot.json').read_text(encoding='utf-8')))

    def test_no_change_preserves_observation_timestamp(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); first=snapshot(); updater.publish(first,root,NOW)
            second=copy.deepcopy(first); second['retrievedAt']='2026-10-21T00:00:00+00:00'
            self.assertFalse(updater.publish(second,root,NOW))
            self.assertEqual(json.loads(root.joinpath('data/snapshot.json').read_text(encoding='utf-8'))['retrievedAt'],first['retrievedAt'])

    def test_revisions_are_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); first=snapshot(); updater.publish(first,root,NOW)
            second=copy.deepcopy(first); second['series']['earnings']['data'][-1]['value'] += .1
            self.assertTrue(updater.publish(second,root,NOW))

    def test_truncated_success_cannot_replace_good_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); first=snapshot(); updater.publish(first,root,NOW); before=root.joinpath('data/snapshot.json').read_bytes()
            second=copy.deepcopy(first); second['series']['cpi']['data'].pop(0)
            with self.assertRaises(ValueError): updater.publish(second,root,NOW)
            self.assertEqual(root.joinpath('data/snapshot.json').read_bytes(),before)

    def test_failure_keeps_last_good_and_marks_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); updater.publish(snapshot(),root,NOW); before=root.joinpath('data/snapshot.json').read_bytes()
            updater.mark_failure(root,NOW)
            self.assertEqual(root.joinpath('data/snapshot.json').read_bytes(),before)
            status=json.loads(root.joinpath('status.json').read_text(encoding='utf-8')); self.assertFalse(status['ok']); self.assertIn('lastSuccess',status)

    def test_retry_eventual_success(self):
        with patch.object(updater.urllib.request,'urlopen',side_effect=OSError('offline')) as request,patch.object(updater.time,'sleep'):
            with self.assertRaises(OSError): updater.fetch(2023,2026)
            self.assertEqual(request.call_count,3)


if __name__ == '__main__': unittest.main()
