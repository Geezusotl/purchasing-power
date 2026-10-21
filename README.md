# Purchasing Power

**Prices, pay, and the space between.** An independent US economic dashboard
that collects official BLS data, compares earnings with consumer prices, and
calculates how much money preserves the buying power of a past amount.

Designed as a quiet economic publication: off-white paper, dark ink, readable
charts, modest controls, and visible source notes. No generated commentary,
paid model, account, tracking, or external browser dependencies.

## Use it

Download the repository ZIP, extract it, and open **index.html**. Everything
runs locally, including the charts, calculator, source table, and CSV export.
The bundled observations are real BLS data, not example or generated data.
Offline copies remain at their downloaded snapshot until you update them.

For a local server, run `python -m http.server 8000` and open
`http://localhost:8000`. No install is required for the dashboard or updater.

## What it does

- Tracks consumer-price inflation, private-sector average hourly earnings,
  real hourly earnings growth, and unemployment.
- Compares earnings and prices over 1, 5, 10 years, or the complete history.
- Converts dollar amounts between exact months using unadjusted CPI-U.
- Shows year-over-year changes in food-at-home, shelter, and gasoline prices.
- Offers keyboard chart inspection, a monthly data table, and CSV download.
- Displays observation months, retrieval time, update-check time, revisions,
  and preliminary flags separately.
- Preserves missing observations and breaks chart lines at missing months.
- Keeps the previous valid snapshot if collection fails, and shows a warning.

## Automatic updates and GitHub Pages

The included workflow checks BLS daily at **15:23 UTC** (11:23 AM Eastern during
daylight time, 10:23 AM in standard time). New data is published on BLS's own
monthly release schedule; a daily check does not create daily observations.

One-time setup for your own public repository:

1. Push these files to the default branch named **main**.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → Refresh data and publish dashboard → Run workflow**.
4. The deployment job displays the live GitHub Pages address.

The workflow uses GitHub's temporary `GITHUB_TOKEN` with narrowly scoped write
permissions for snapshot commits and Pages deployment. No personal token, BLS
registration, API key, or computer left on is needed. GitHub may ask a repository
owner to enable Actions or approve its first run. These are deployment workflows,
not a claim that this particular repository is already deployed.

GitHub schedules may be delayed and scheduled workflows in public repositories
can be disabled after 60 days without repository activity. Successful daily status
commits normally keep this repository active, but this is not an uptime guarantee.
If checks stop, the page shows an overdue notice after three days. Keep normal
GitHub workflow failure notifications enabled to receive collection failures.

The updater refreshes the complete history in ten-calendar-year requests so
revisions are collected. It currently uses two requests per refresh, plus bounded
retries, within BLS's unregistered limits. The number increases by one per decade.
No automatic workflow can run until the project has been placed in a repository
and Actions is enabled.

## Data and economic boundaries

Observations begin in 2007. The price calculator uses **CUUR0000SA0** (CPI-U,
all items, unadjusted). The earnings comparison uses **CES0500000003** with
**CUSR0000SA0** so both plotted series are seasonally adjusted. Unemployment
uses **LNS14000000**. Category indices are unadjusted CPI-U.

Real annual earnings growth is a **ratio of ratios**, not wage-growth percentage
minus inflation percentage. Annual comparisons require the exact month one year
earlier. Missing observations are not interpolated. A missing October 2025 CPI
observation, for example, makes that exact-month conversion unavailable.

Average pay is not median pay or the typical employee's raise. Changes in the
mix of workers affect average earnings. CPI is a national price measure and
does not compare costs of living between cities. These calculations do not
establish causation or predict future prices.

Full formulas, series, and interpretation notes: [Methodology](docs/Methodology.md).

## Development and checks

Python 3.10+ and Node 22+ for development checks:

```sh
npm ci --ignore-scripts
python -m unittest discover -s tests -v
npm test
python scripts/build.py
```

The only installed package is a **development-only** DOM simulator. It is not
shipped to visitors. Tests verify economic formulas against hand-calculated
answers, missing-month behavior, last-good preservation, revision updates,
invalid payload rejection, range controls, calculator inputs, keyboard chart
inspection, warnings, table generation, and download creation.

Run an official refresh manually:

```sh
python scripts/update_data.py
```

Never edit the generated snapshots to make economic results look better. See
[Validation](docs/Validation.md) for the actual local checks and limitations.

## Project map

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Static interface and interactive SVG chart |
| `math.js` | Shared, testable economic calculations |
| `scripts/update_data.py` | BLS collection, validation, revision handling |
| `data/snapshot.json`, `data.js` | Identical official observations in download and offline-browser formats |
| `status.json`, `status.js` | Last attempted and successful update checks |
| `scripts/build.py` | Allowlisted static deployment build |
| `.github/workflows/` | Cross-platform checks and daily refresh/deployment |
| `tests/` | Python and JavaScript checks |

## Design references

- [FRED](https://fred.stlouisfed.org/series/CPIAUCSL): clear period controls,
  direct series labels, and explicit units.
- [Our World in Data](https://ourworldindata.org/grapher/inflation-of-consumer-prices):
  chart-first hierarchy, downloadable observations, and visible methodology.
- [BLS inflation calculator](https://www.bls.gov/data/inflation_calculator.htm):
  a focused conversion task with a clearly identified CPI basis.

These informed the information design. No logos, source code, screenshots,
fonts, or other assets were copied from those services. This is an independent
project, not an official BLS, FRED, or Our World in Data product.

Created with AI assistance. MIT-licensed application code; BLS is credited as the
source of the economic observations.
