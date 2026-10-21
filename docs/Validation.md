# Validation record

Checked locally on October 20, 2026.

## Completed

- Retrieved seven official BLS series covering January 2007–September 2026,
  237 monthly rows each, from the live v1 API using two date-range requests.
- Preserved provider-reported unavailable values as null, including October
  2025 CPI, rather than filling them with generated observations.
- **17 Python tests passed**: payload status, missing/duplicate series and dates,
  missing numeric observations, annual-average exclusion, numeric bounds,
  future and stale snapshots, retry bounds, revision detection, last-good
  preservation, truncation rejection, and JSON/browser snapshot parity.
- **23 JavaScript tests passed**: 11 economic calculation checks and 12
  DOM-based interface checks. These cover the calculator, zero and reverse
  conversions, real growth, exact-month annual comparisons, missing chart
  segments, period controls, source links, table construction, CSV generation,
  keyboard chart inspection, error states, stale status, and offline runtime.
- Static deployment build completed successfully and contains only allowlisted
  public dashboard files. No runtime package dependency, key, or third-party
  browser request is required.
- Source-data metadata identifies seasonal adjustment separately for all series.

## Scope and remaining checks

The interface checks use jsdom, a DOM simulator. They exercise real scripts and
controls but **do not verify browser rendering, screenshots, mobile layout,
screen-reader behavior, or actual saved download contents**. No screenshot or
cross-browser verification is claimed. The CSS includes responsive layouts and
visible keyboard-focus states; these still need a real-browser visual pass.

The included CI definition targets Linux and Windows on Python 3.10 and 3.13,
with Node 22. That configuration is not a claim that remote CI has already run.
Likewise, the refresh and Pages deployment workflow must run successfully in
the destination repository before unattended hosting is verified.

Tests cannot certify the accuracy of BLS's own published observations. They
verify the app's formulas, handling, and safeguards for the tested cases.
