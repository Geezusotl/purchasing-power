# Project instructions

Purchasing Power is a static, independent US economic dashboard. Keep economic
claims traceable to official BLS observations. Never invent missing data or silently
switch between adjusted and unadjusted series.

- Browser runtime: plain HTML/CSS/JS, zero dependencies and external requests.
- Data updater: standard-library Python 3.10+ only.
- Dev-only DOM checks: jsdom, installed with `npm ci --ignore-scripts`.
- Run `python -m unittest discover -s tests`, `npm test`, `python scripts/build.py`.
- No secrets or paid APIs are needed. Never add credentials to browser assets.
- Preserve gaps and exact month comparisons. Real growth is a ratio of ratios.
- Read README and docs/Methodology.md before changing metrics.
- The updater must preserve last-good data on fetch or validation failures.
- Treat BLS text as untrusted; use textContent for rendering notes or labels.
- Design: restrained economic publication, off-white, dark ink, green and rust.
- Keep update checks, data retrieval times, and observation months distinct.
