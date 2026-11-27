# Artha — A clearer view of value

A desktop equity-research application built from the original PBL repository. It combines reviewed Infosys FY24–FY26 financials, a Python FCFF model, scenarios, comparable analysis and evidence-linked explanations.

The interface uses a light, spacious visual system inspired by Apple's restraint: three primary areas, large readable type and detailed analysis on demand. It supports desktop and tablet workspaces down to 768px, with light/dark appearances and keyboard-accessible dialogs.

## Artha Terminal

A dense, keyboard-first research console sits beside the calm workspace. Open `/#terminal`
(or press `` ` ``), then type `HELP`. Try `WACC 11`, `GP FCFF`, `MC 2000`, `RDCF 1500`,
`SRCH FY2026 revenue`, `ASK how does WACC change the valuation?` or `LOAD TCS`.
Eleven linked panels cover valuation and bridge, history and forecast graph, assumptions,
financial analysis, FCFF schedule, WACC × g sensitivity, peers, reconciliations,
identifiers and evidence, plus a console. Every number is labelled FACT, ASM, CALC or
INTERP. See [docs/TERMINAL.md](docs/TERMINAL.md).

## Deploy on Vercel

`Dockerfile.vercel` runs the Node server and stdlib-only Python workers on Vercel's container
runtime as an anonymous, read-only demo (`APP_PUBLIC_ACCESS=true`, `ARTHA_STORAGE_MODE=browser`,
`TRUST_PROXY=1`). Set `APP_AUTH_PASSWORD` in the Vercel project to require sign-in instead.

```bash
vercel deploy --prod
```

## Run the complete application

Install Node.js 20+ and Python 3.10+. The application has no third-party JavaScript or Python runtime dependencies.

```bash
npm run build
npm start
```

Open http://127.0.0.1:3000. Python owns the financial calculations; Node serves the desktop UI and API. Rebuild after changing public files or reviewed data. The original pandas/Jupyter analysis remains available separately; install `requirements.txt` only for the notebook, data tools and full development tests.

For a container deployment, copy `.env.example` to `.env`, set your own `APP_AUTH_PASSWORD`, then run:

```bash
docker build -t artha-equity .
docker run --env-file .env -e HOST=0.0.0.0 -p 3000:3000 -v artha-runtime:/app/data/runtime artha-equity
```

Follow [the deployment guide](docs/DEPLOYMENT.md) for authentication, persistent storage, HTTPS and verification. No credentials are included. The Docker image definition is provided; an image build was not executed in this environment.

## Features

- Validated multi-company activation with issuer-specific snapshots, dated source
  facts, official filing URLs/pages/publication dates/units and 12 reconciliation
  checks per issuer. Infosys is the only fully reviewed production dataset today;
  TCS/HCLTech/Wipro remain peer-only until full standalone evidence is reviewed.
- Five annual growth and margin inputs, Python FCFF/sensitivity and an accessible
  EV-to-equity SVG waterfall with exact table values.
- Fixed-seed Monte Carlo P5/P50/P95 and histogram, plus reverse DCF for a
  user-supplied hypothetical price. Missing market evidence stays unavailable.
- Native state/views/dialogs/charts/API modules, dark mode, 768px layout, skeleton
  states, focus containment and accessible status feedback.
- Bounded stdlib Python workers, protected readiness, safe JSON request logs,
  failed-login throttling, SQLite WAL, configurable retention and online backup.
- Root-level CodeQL, Dependabot and full-check GitHub workflows.

See [onboarding](docs/COMPANY_ONBOARDING.md), [scenario contracts](docs/VALUATION_STUDIES.md),
[UI modules](docs/UI_MODULES.md) and [operations](docs/OPERATIONS.md).

## Three main areas

- **Company:** reported history, source periods, revenue/profit/cash-flow charts, three-statement selected lines and fundamental ratios.
- **Valuation:** base/bull/bear/custom assumptions, CAPM/WACC, five-year FCFF, terminal value, sensitivity, equity bridge and comparable multiples.
- **Research:** explanations linked to reviewed financial facts and official sources, with an optional server-side language-model connector.

Sources, reconciliation checks, saved scenarios and methodology open in dialogs. JSON, CSV, browser print-to-PDF and the complete source ZIP are available from Export. Scenarios and market-import drafts use browser storage. Explicitly saved Python valuations also create immutable local SQLite snapshots with assumptions, provenance and market evidence in the input hash.

## Hosted preview and full application

The hosted Site is a static desktop preview. Its base/bull/bear results and supported explanations are compiled by Python during the build. It does not run a browser financial engine or a Python server. Custom recalculation, CAPM, market imports, SQLite history and optional live LLM calls require the complete Node + Python application.

## Financial scope

The reviewed example is Infosys, with TCS, HCLTech and Wipro FY26 reported-basis peer financials. The default case is an explicitly retrospective March 31, 2026 valuation using later-published annual reports. It is provisional: growth, WACC, margins, sustainable reinvestment, excess cash and employee-award dilution need analyst review.

No price, upside or market multiple is invented. Reviewed official BSE CSV evidence and date-compatible shares are required to activate market comparisons; optional peer bridge inputs require an official-company financial source. Reported EBIT is distinguished from pre-exception EBIT. March 2026 net shares are 404.6940812 crore, already excluding treasury.

This is a deployable research MVP. Automatic ticker/news ingestion, actual FinBERT inference, full PDF/vector RAG and academic report/presentation deliverables are not implemented. The [requirements audit](docs/REQUIREMENTS_AUDIT.md) records the boundary.

## API

All POST bodies are JSON objects. Company operations require a registered
`companyId`; optional `assumptions` must be a complete assumption object. Rates
are decimals, money is INR crore and per-share results are INR.

| Method | Endpoint | Input / result |
|---|---|---|
| GET | `/api/health` | Public liveness and model version |
| GET | `/api/ready` | Protected Python, all-issuer reconciliation and SQLite readiness; 503 if unavailable |
| GET | `/api/companies` | Registered valuation-ready issuer IDs |
| POST | `/api/valuation` | `{companyId, assumptions?, persist?, marketOverrides?}` → Python FCFF, sensitivity, bridge, checks |
| POST | `/api/analytics` | `{companyId, assumptions?}` → fundamental ratios; unsupported ratios are null |
| POST | `/api/capital-cost` | `{inputs}` → Python CAPM/WACC |
| POST | `/api/monte-carlo` | `{companyId, assumptions?, options?}` → fixed-seed quantiles and 20 histogram bins |
| POST | `/api/reverse-dcf` | `{companyId, assumptions?, price}` → flat implied annual growth and residual |
| GET | `/api/runs?companyId=infosys` | Bounded saved-run metadata |
| POST | `/api/packet` | `{companyId, assumptions?}` → reviewed research packet |
| POST | `/api/retrieval` | `{companyId, question}` → ranked source facts |
| POST | `/api/assistant` | `{companyId, question, assumptions?}` → cited evidence or validated optional LLM explanation |

`margins` optionally supplies five annual operating margins; scalar `margin` is
kept as the fallback for older saved scenarios. Monte Carlo defaults to 1000
iterations (100–5000), uniform growth/margin/WACC spreads of .02/.01/.01, seed
1729. Reverse DCF holds other assumptions fixed and solves over [-50%,100%].
Neither study manufactures a market quote or upside.

Protected routes use existing Basic auth and strict CSP. POST operations enforce
same-origin, 32,000-byte bodies and JSON content type. Errors use 400 for malformed
requests, 401/403 for auth/origin failures, 415 for content type, 422 for invalid
model inputs, 429 for limits, and 503 for unavailable worker/readiness capacity.
Production requires `APP_AUTH_PASSWORD`; use HTTPS. For a TLS proxy set the exact
`APP_PUBLIC_ORIGIN`; forwarded headers do not determine origin or rate-limit IP.

## Optional language model

Evidence mode works without a key. To use a provider, set `LLM_API_KEY`, `LLM_MODEL` and the HTTPS `LLM_API_URL` in your local environment, then run:

```bash
node --env-file=.env backend/server.mjs
```

Provider keys stay server-side. Retrieved facts and deterministic Python outputs ground the response; invalid citations/numerical claims trigger an evidence fallback. No live provider call was verified for this release. Structured-fact BM25 retrieval is implemented; this is not full annual-report vector RAG.

## Development verification

```bash
npm run check
npm run preflight
```

Full tests require `requirements.txt`. `check` builds and runs all Node and Python tests; `preflight` validates every registered web issuer using only the standard library. The older `python3 scripts/preflight.py --no-write` checks the separate notebook CSV registry. Runtime smoke tests additionally run the service with Python site packages disabled. Tests compare the portable Python model with the independent pandas notebook engine across scenarios and cover reconciliation, cutoff dates, shares, API validation and authentication.

## Learn and inspect

Read [the learning guide](docs/LEARNING_GUIDE.md) for concepts before code, [architecture](docs/ARCHITECTURE.md) for service contracts, [model review](docs/MODEL_REVIEW.md) for financial assumptions and [design system](docs/DESIGN_SYSTEM.md) for the visual direction.

| Path | Responsibility |
|---|---|
| `src/portable_finance.py` | Dependency-free production Python FCFF model and sensitivity |
| `backend/python_service.py` | Validated Python API adapter, analytics and comparable values |
| `src/fundamental_analytics.py` | Ratios, CAPM/WACC, multiples and peer-implied values |
| `src/research_store.py` | SQLite snapshots and input fingerprints |
| `backend/server.mjs` | HTTP, authentication, API limits and optional LLM connector |
| `public/app.js`, `public/styles.css` | Desktop interactions and visual system |
| `scripts/prepare_preview.py` | Python compilation of static preview results |
| `data/source_snapshot.json` | Reviewed official evidence |
| `src/equity_platform.py` | Retained pandas notebook/reference model |
| `Dockerfile`, `compose.yaml` | Full-application deployment |
| `tests/`, `web-tests/` | Python, JavaScript, API and parity checks |

Original repository: https://github.com/adityamakurwar97-cyber/Ai-powered-Equity-reserch-and-Valuation-platform-

The original license and learning materials are preserved. This deliverable does not push changes to that original GitHub remote.

Browser QA is provided by `scripts/check_ui.mjs` using a separately installed
Playwright developer tool. This environment could not launch Chromium because of
an OS socket restriction. Automated module, keyboard-helper and theme-token checks
pass; full visual/assistive-technology WCAG 2.2 AA validation remains unverified.
The detailed release report records all changed files and executed checks.
