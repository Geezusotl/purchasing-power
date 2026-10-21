# Sources and methodology

## Official source

Observations are fetched from the [BLS Public Data API v1](https://www.bls.gov/developers/api_signature.htm).
Unregistered access allows 25 queries per day, 25 series per query, and ten
calendar years per request. The updater requests seven series in chronological,
nonoverlapping ten-year batches, beginning with 2007–2016. It rereads history to
capture official revisions. Up to three attempts are made per batch. Updater
success means the response and snapshot passed checks, not that BLS published new
data. Daily status commits and changed observation commits are distinguishable
through their file contents.

| Key | Series ID | Measure | Seasonal adjustment |
| --- | --- | --- | --- |
| `cpi` | CUUR0000SA0 | CPI-U, all items, US city average | None |
| `cpiAdjusted` | CUSR0000SA0 | CPI-U, all items, US city average | Adjusted |
| `earnings` | CES0500000003 | Average hourly earnings of all employees, total private | Adjusted |
| `unemployment` | LNS14000000 | Civilian unemployment rate | Adjusted |
| `food` | CUUR0000SAF11 | CPI-U, food at home | None |
| `shelter` | CUUR0000SAH1 | CPI-U, shelter | None |
| `gas` | CUUR0000SETB01 | CPI-U, gasoline, all types | None |

Series pages are available at `https://data.bls.gov/timeseries/SERIES_ID`.
CPI index units are 1982–84 = 100. Earnings are dollars/hour. Unemployment is a
percentage. Index levels in different categories are not comparable dollar prices.

## Calculations

For observation X at month t, annual change is `(X[t] / X[t−12] − 1) × 100`.
The exact calendar month is looked up; the code never substitutes the twelfth
previous available observation. A missing comparator produces an unavailable
result. Annual CPI change uses unadjusted CPI-U.

Real average hourly pay change is
`((wage[t] / wage[t−12]) / (CPI_SA[t] / CPI_SA[t−12]) − 1) × 100`.
The real-pay card uses the most recent month common to earnings and adjusted CPI.
Both series are adjusted; this is a transparent dashboard calculation, not a
claim to reproduce every convention of the BLS Real Earnings release.

The comparison chart rebases the adjusted earnings and CPI series to 100 at the
first valid common month on or after the chosen starting date. One-year means
the same month one calendar year earlier through the endpoint, inclusive.
The endpoint is the latest valid month common to both series. The period summary
uses that same baseline and endpoint, including for real growth.

The calculator uses `amount × CPI_NSA[target] / CPI_NSA[source]`. It compares
exact calendar months; unlike some annual calculators it does not use complete
annual averages or year-to-date averages. Historical and reverse conversions use
the same ratio. Zero dollars remain zero. Results are rounded only for display;
calculations use the original numeric observations.

## Validation and missing data

Each response must be successful and contain every required series, at least
twelve numeric observations per batch, valid distinct monthly dates, finite
nonnegative values, and plausible unemployment bounds. Price indices and earnings
must be positive. M13 annual averages are ignored. Explicit unavailable values
become JSON `null`; absent months are also treated as missing by calculations.
SVG paths break at explicit or absent missing months. Calculators omit unavailable
months from the options. No synthetic values, forecasts, or interpolation are used.

The combined snapshot requires at least 24 numeric observations per series,
rejects future dates, rejects unexpectedly old responses (over six calendar months),
and cannot drop historical dates or regress a latest month from an existing
snapshot. Numeric revisions and updated footnotes are accepted. This does not
independently verify BLS values or detect every plausible provider error.

Response and snapshot validation finish before observations are written. Each file
replacement is atomic. A workflow publishes the built artifact only after the
updater and build finish, so visitors receive a coherent static version. Individual
local file replacements are not a filesystem-wide transaction; an interrupted local
update may require rerunning the updater to synchronize `data.js` and JSON.

If collection fails, the observation files remain at the last-good snapshot.
The failure status is still committed and deployed; a separate reporting job marks
the workflow failed so normal GitHub failure notifications can apply. If a commit,
build, or deployment itself fails, the previously deployed site remains available
and its check age eventually shows overdue.

## Interpretation

- This is national US data, not a New York cost-of-living measure.
- Average hourly earnings cover private employees and change with worker mix.
  They are not median earnings or a distributional welfare measure.
- The sharp 2020 earnings movements partly reflect compositional changes, so a
  selected starting month can materially change the comparison.
- Shelter includes owners' equivalent rent and tenant rent; it is not house prices.
- Food at home excludes restaurant meals. Gasoline is a price index, not dollars
  per gallon. Category bars show their own latest available month and use a
  labeled zero marker, with space for both negative and positive annual changes.
- New BLS releases can revise earlier values, especially adjusted series and
  payroll earnings. This is a current-vintage dataset, not a vintage archive.
- A declining inflation rate does not necessarily imply declining price levels.
- The descriptions are generated from arithmetic and fixed templates. No language
  model infers explanations, causes, or predictions from these data.

References: [BLS CPI FAQ](https://www.bls.gov/cpi/questions-and-answers.htm),
[BLS API FAQ](https://www.bls.gov/developers/api_faqs.htm),
[BLS CPI calculator](https://www.bls.gov/data/inflation_calculator.htm),
[GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
