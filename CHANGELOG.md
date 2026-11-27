# Changelog

## v1.4.1 — 2026-11-27

- Add **Artha Terminal** (`#terminal`, or press `` ` ``): a dense, keyboard-first research
  console with a command line (HELP, DES, FA, GP, DCF, SENS, COMP, CHK, EVID, WACC, TG,
  GROW, MARGIN, TAX, DA, CAPEX, NWC, MC, RDCF, ASK, SRCH, LOAD, EXP, CSV, CLR, EXIT),
  command history, Tab completion, F-key bar, a metric tape and eleven linked panels.
  Every figure carries a FACT / ASM / CALC / INTERP label. The terminal computes nothing;
  values come from reviewed data or the Python engine. Non-reviewed issuers such as TCS
  explain what evidence would qualify them instead of showing a fabricated valuation.
  The original Company / Valuation / Research workspace is unchanged.
- Security: proxy-aware client IP, origin and HSTS handling (`TRUST_PROXY`); refuse
  `Sec-Fetch-Site: cross-site` writes; whitelist Monte Carlo / reverse-DCF / analytics
  fields instead of spreading client JSON into worker requests; Python workers receive a
  minimal environment, so passwords and LLM keys never reach them; stricter CSP
  (`script-src 'self'`, `object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`,
  no third-party font hosts), X-Frame-Options, COOP/CORP and Permissions-Policy;
  UTF-8-safe request body decoding; request/header timeouts and graceful SIGTERM.
- Hosting: `ARTHA_STORAGE_MODE=browser` disables server SQLite history on ephemeral hosts;
  `APP_PUBLIC_ACCESS=true` is an explicit opt-in for an anonymous production demo;
  `Dockerfile.vercel` targets the Vercel container runtime; GitHub Actions CI.
- Tests: parity tests use `.venv` automatically; new terminal and security suites
  (71 Node tests, 56 Python tests, 12/12 Infosys reconciliations).
- Lineage note: built on the v1.4.0 release package. The deployed v1.5.0 source
  (listing directory, provider charts, research notebook) was not available here.

## v1.4.0 — 2026-11-12

- Add reviewed multi-company package activation, issuer-isolated snapshots, a real
  company selector, all-registered reconciliation tests and synthetic second-issuer
  onboarding tests. Full peer-only datasets are not fabricated or activated.
- Add annual forecast margins, seeded stdlib Monte Carlo with quantiles/histogram,
  and validated reverse DCF for hypothetical user prices through Python APIs.
- Add system-aware/manual dark mode, tablet layout down to 768px, skeletons,
  background-inert dialogs, focus trapping, and an accessible SVG equity bridge.
- Split app.js into native state, API, views, dialogs and chart modules. Retain
  every legacy numerical assertion in a test-only JS benchmark; remove financial
  calculations from deployable browser assets. Add JSDoc and Python annotations
  and docstrings throughout src/ without changing the benchmark formulas.
- Add bounded Python admission, protected readiness, safe structured request logs,
  failed-login throttling, exact-origin proxy configuration, WAL/retention and
  online integrity-checked backups. Keep existing security and LLM validation.
- Add check/preflight commands, root GitHub CodeQL/Dependabot/verification workflows,
  unit/API/module/accessibility-helper/store/pool tests and operational docs.
- Verification limitation: real Chromium visual checks are blocked by this
  environment's socket restriction. Full WCAG 2.2 AA conformance is not certified.
