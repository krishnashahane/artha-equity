# Reviewed company onboarding

The web registry is `data/companies.json`. Only Infosys currently has a complete
reviewed three-year dataset. Peer financial summaries do not qualify as standalone
DCF evidence. Do not clone Infosys numbers into another issuer's production data.

1. Run `python3 scripts/create_company_workspace.py --company-id example --company 'Example Limited' --bse-scrip 123456 --isin INE000000001 --sector Manufacturing --ticker EXAMPLE --official-domain example.com` for a new issuer. Existing peer-only IDs such as tcs can be upgraded with this command and their verified issuer metadata; active or scaffolded IDs are rejected.
2. Fill `data/workspaces/example/package.json` using the company descriptor schema
   in `data/companies.json` and snapshot schema in `data/source_snapshot.json`.
   Supply exactly three consecutive consolidated annual periods in INR crore.
   Each required financial field needs a matching fact with official HTTPS URL,
   positive PDF page, publication date, source ID, value and unit. Share observations
   require their own dated source page. `officialDomain` must be manually verified.
   Forecast and bridge inputs are explicit assumptions, never reported facts.
3. Review every value against the original filings, then set `reviewed: true`.
4. With the server stopped, run `python3 -S scripts/activate_company.py --package data/workspaces/example/package.json`.
   Validation completes before evidence is written; the registry is published by
   atomic rename last. Existing issuer packages are never overwritten. The saved snapshot is fingerprinted; later file tampering blocks model/readiness checks. If interrupted
   before publication, inspect/remove the orphaned reviewed.json before retrying.
5. Run `npm run check` and `npm run preflight`, rebuild and restart the server.
   The selector and preview cases now include the new issuer. Its analytics and
   valuation use its own snapshot; missing prices/multiples remain unavailable.

The older CSV/pandas notebook workflow remains available with `--company`. It has
its own `config/company_registry.csv`; it does not activate web coverage. The
stdlib `--package` workflow is the supported production onboarding path. Tests
exercise a clearly labelled synthetic second issuer only in temporary directories.

`prepare_data.py` refreshes the reference Infosys transformation while preserving other registered web companies and existing peer/workspace universe rows. Rebuilding the application never runs this reference-data regeneration implicitly.
