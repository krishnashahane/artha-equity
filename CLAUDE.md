# Working on Artha Equity

- Python (`src/portable_finance.py` and friends, via `backend/python_service.py`) is the only
  authority for production financial calculations. Browser modules (`public/*.js`, including
  `public/terminal.js`) render values and never compute valuations.
- Keep the four evidence labels distinct in UI, exports and AI answers: reported fact,
  analyst assumption, calculation, interpretation.
- Never fabricate market prices, peer valuations or filings. Unavailable stays unavailable.
- Run before committing: `npm run check` (build + Node + Python tests) and `npm run preflight`.
- Default UI is the calm Company / Valuation / Research workspace; the dense terminal is an
  opt-in surface at `#terminal` (see docs/TERMINAL.md).
- Never commit `.env`; deployment secrets live in the host's environment settings.
