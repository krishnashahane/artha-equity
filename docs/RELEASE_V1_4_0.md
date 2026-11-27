# Artha Equity v1.4.0 implementation and verification

Date: 2026-11-12. Base commit: `44c9d74` in
`adityamakurwar97-cyber/artha-equity-2`; app directory: `artha-equity 2/`.
Changes are committed locally. No remote push, deployment or live provider call
was performed. No third-party application runtime dependencies were added.

## Results and scope

- A: Reviewed multi-company activation, per-issuer snapshot isolation, fingerprint
  checks, real selector and all-registered 12-check tests. A synthetic second issuer
  is activated and valued only in temporary test workspaces; no second production
  company is falsely presented as reviewed. Existing peer-only IDs can be scaffolded
  for review. Reference-data regeneration preserves other registered issuers.
- B: Five annual growth and operating margins, fixed-seed stdlib Monte Carlo with
  P5/P50/P95 and histogram, and reverse DCF through validated Python API routes.
  Per-year margin parity with the pandas model is tested within 1e-8, including EV.
- C: System/manual dark mode, 768px adaptation, focus-contained/inert dialogs,
  loading skeletons, status regions and Python-supplied SVG waterfall plus table.
  Automated focus-helper and theme-token tests pass. Actual Chromium cannot launch
  here because a required socket operation is denied. Full visual and assistive-
  technology WCAG 2.2 AA conformance is therefore **unverified**, not certified.
- D: Native state/views/dialogs/charts/API modules, JSDoc contracts and Python type
  hints/docstrings throughout src/. Legacy JS numerical assertions remain intact
  in a test-only reference file; browser assets contain no valuation engine.
- E: Bounded process workers, JSON request logging, protected readiness, failed-
  login throttling, WAL storage/retention, online backup, CodeQL/Dependabot/Verify.
  GitHub workflow files are at repository root. GitHub execution is unverified.

Missing price, share-dilution and multiple evidence stays unavailable. Reverse-DCF
prices and Monte Carlo distributions are explicit user/analyst scenarios. No
second-company financials, market prices, shares or upside were invented. Existing
constant-time auth, 32,000-byte bodies, same-origin/rate/path/CSP protections and
LLM checks were preserved; numeric claims are additionally checked in LLM titles.

## Commands and observed output

Inspection commands (`pwd`, `rg`, file reads, `git status`, `git diff`, runtime
version checks) were used throughout. Relevant execution/verification results:

| Command / step | Result | Observed output |
|---|---|---|
| `git clone https://github.com/adityamakurwar97-cyber/artha-equity-2.git .../repo` | PASS | Repository cloned; base 44c9d74 |
| `node --version` | PASS | v24.22.1 (CI targets Node 20) |
| `python3 -c 'import pandas,numpy; print(pandas.__version__)'` | PASS | 2.2.3 |
| Baseline `npm run build && npm test && python3 -m unittest discover -s tests` | PASS | Build; 40 Node tests; 40 Python tests |
| First onboarding check | FAIL, corrected | Synthetic fixture included peer-source domains; reduced fixture to issuer financial documents, retaining strict validation |
| Onboarding `npm run check` / `npm run preflight` | PASS | 40 Node, 45 Python; preflight PASS |
| Valuation studies `npm run check` / `npm run preflight` | PASS | 44 Node, 50 Python; preflight PASS |
| UI/accessibility-helper `npm run check` / `npm run preflight` | PASS | 47 Node, 50 Python; preflight PASS |
| Module split `npm run check` / `npm run preflight` | PASS | 51 Node, 50 Python; preflight PASS |
| Operations checks | PASS | Expanded to 58 Node / 53 Python; later expanded with regression cases |
| Final `npm run check` | PASS (exit 0) | Build succeeded; 63 Node tests passed, 0 failed/skipped; 56 Python tests OK |
| Final `npm run preflight` | PASS (exit 0) | infosys: 12/12 reconciliations PASS; Preflight PASS |
| `python3 scripts/preflight.py --no-write` | PASS (exit 0) | Preflight passed; no manifest written (legacy notebook registry) |
| `npm run model -- --company infosys --scenario base --output /tmp/artha-model.json` | PASS (exit 0) | Saved research packet; Python authority; model 1.4.0 |
| `node --check public/app.js` and `node --check public/dialogs.js` | PASS | Exit 0; native module graph also executes in tests |
| Playwright default Chromium launch | FAIL / environment | Expected bundled browser executable is absent |
| Playwright with `/usr/bin/chromium` | BLOCKED / environment | `socket() failed: Operation not permitted (1)`; no browser assertions were executed |
| `git diff --check` | PASS | No whitespace errors |

Full final outputs: [check](verification/v1.4.0-check.txt) and
[preflight](verification/v1.4.0-preflight.txt). npm prints an inherited environment
warning about `http-proxy`; it does not fail either command. Browser follow-up is
reproducible using scripts/check_ui.mjs and a separate Playwright installation.
Docker builds, real browser/AT audits, remote CI, and a live LLM were not run.

## Reviewable commits

```
a3b8d7d Add reviewed company activation and isolated issuer snapshots
c4f9937 Add annual margins, seeded Monte Carlo and reverse DCF studies
b3d88a1 Add tablet layout, dark appearance and accessible dialog and chart states
010be07 Split UI into native modules and keep numerical benchmarks out of public assets
8516de2 Add bounded workers, readiness, request logs and WAL-safe operations
8c08548 Preserve onboarded issuers during refresh and verify reviewed fingerprints
7f0b3db Fix issuer labels, stale conversations and annual scenario margin handling
470ee0c Document release verification and add repeatable browser QA
```

A final documentation commit adds this report and verification outputs.

## Every changed file

Paths below are relative to the Git repository root, including CI outside the app
subfolder. All existing financial data files remain unchanged.

- `.github/dependabot.yml`
- `.github/workflows/check.yml`
- `.github/workflows/codeql.yml`
- `artha-equity 2/.env.example`
- `artha-equity 2/.gitignore`
- `artha-equity 2/CHANGELOG.md`
- `artha-equity 2/README.md`
- `artha-equity 2/backend/python_bridge.mjs`
- `artha-equity 2/backend/python_service.py`
- `artha-equity 2/backend/server.mjs`
- `artha-equity 2/docs/ARCHITECTURE.md`
- `artha-equity 2/docs/COMPANY_ONBOARDING.md`
- `artha-equity 2/docs/DESIGN_SYSTEM.md`
- `artha-equity 2/docs/OPERATIONS.md`
- `artha-equity 2/docs/RELEASE_V1_4_0.md`
- `artha-equity 2/docs/UI_MODULES.md`
- `artha-equity 2/docs/VALUATION_STUDIES.md`
- `artha-equity 2/docs/verification/v1.4.0-check.txt`
- `artha-equity 2/docs/verification/v1.4.0-preflight.txt`
- `artha-equity 2/package.json`
- `artha-equity 2/public/api.js`
- `artha-equity 2/public/app.js`
- `artha-equity 2/public/charts.js`
- `artha-equity 2/public/dialogs.js`
- `artha-equity 2/public/engine.js`
- `artha-equity 2/public/focus.js`
- `artha-equity 2/public/index.html`
- `artha-equity 2/public/state.js`
- `artha-equity 2/public/styles.css`
- `artha-equity 2/public/views.js`
- `artha-equity 2/scripts/activate_company.py`
- `artha-equity 2/scripts/backup_research.py`
- `artha-equity 2/scripts/check_ui.mjs`
- `artha-equity 2/scripts/cli.mjs`
- `artha-equity 2/scripts/create_company_workspace.py`
- `artha-equity 2/scripts/preflight_web.py`
- `artha-equity 2/scripts/prepare_data.py`
- `artha-equity 2/scripts/prepare_preview.py`
- `artha-equity 2/src/company_workspace.py`
- `artha-equity 2/src/equity_platform.py`
- `artha-equity 2/src/fundamental_analytics.py`
- `artha-equity 2/src/market_data.py`
- `artha-equity 2/src/portable_finance.py`
- `artha-equity 2/src/project_runner.py`
- `artha-equity 2/src/provenance.py`
- `artha-equity 2/src/research_packet.py`
- `artha-equity 2/src/research_store.py`
- `artha-equity 2/src/valuation_studies.py`
- `artha-equity 2/tests/test_company_workspace.py`
- `artha-equity 2/tests/test_store_ops.py`
- `artha-equity 2/tests/test_valuation_studies.py`
- `artha-equity 2/web-tests/api.test.mjs`
- `artha-equity 2/web-tests/engine.test.mjs`
- `artha-equity 2/web-tests/modules.test.mjs`
- `artha-equity 2/web-tests/ops.test.mjs`
- `artha-equity 2/web-tests/python-parity.test.mjs`
- `artha-equity 2/web-tests/reference_engine.mjs`
- `artha-equity 2/web-tests/ui.test.mjs`
