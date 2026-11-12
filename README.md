<div align="center">

# artha.

### A clearer view of value

**Source-backed equity research and FCFF valuation for Indian listed companies, with a Python engine, every number traceable to its source, and a calm desktop UI.**

[![CI](https://github.com/krishnashahane/artha-equity/actions/workflows/ci.yml/badge.svg)](https://github.com/krishnashahane/artha-equity/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/python-3.10%2B-3776AB?logo=python&logoColor=white)
![Runtime deps](https://img.shields.io/badge/runtime%20dependencies-0-success)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## Why Artha?

Most DCF spreadsheets hide their assumptions and invent the inputs they lack. Artha does the opposite:

- **Every figure has a source.** Reported financials link to the official annual report, with PDF page, publication date and unit conversion.
- **Nothing is made up.** Artha never invents a missing price, multiple or upside. Market comparisons switch on only when there is reviewed BSE close evidence and a share count from the same date.
- **Python is the calculation authority.** One dependency-free Python engine produces every valuation. An independent pandas notebook engine checks it to `1e-8` in CI.
- **Assumptions stay visible.** Base, bull, bear and custom cases always carry their WACC, growth, margin and retrospective-study labels.

The reviewed example is **Infosys (BSE 500209), FY24–FY26**, with **TCS, HCLTech and Wipro** as FY26 reported-basis peers.

## Features

| Area | What you get |
|---|---|
| **Company** | Three-year reported history, revenue/profit/cash-flow charts, selected lines from the three statements, ROE/ROA/liquidity ratios |
| **Valuation** | Base/bull/bear/custom cases, CAPM → WACC builder, 5-year FCFF forecast, terminal value, 5×5 WACC × growth sensitivity, equity bridge, peer multiples and implied values |
| **Research** | Explanations grounded in the source facts, with BM25 retrieval over them and citations you can click. An optional server-side LLM's answer is rejected if it cites an unknown source or states a number not in the packet |
| **Evidence** | Source ledger, 12 accounting reconciliation checks, saved scenarios, immutable SQLite valuation snapshots with input fingerprints |
| **Export** | JSON research packet, CSV, print-to-PDF report, full source ZIP |

## Quick start

**Requirements:** Node.js 20+ (22 LTS recommended) and Python 3.10+. The app itself needs **no** `npm install` and **no** pip packages.

```bash
git clone https://github.com/krishnashahane/artha-equity.git
cd artha-equity
npm run build      # compiles UI + Python-computed preview cases into dist/
npm start          # http://127.0.0.1:3000
```

Rebuild after you change files in `public/` or the reviewed data.

### Development setup (full test suite, notebooks, data tools)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm run check      # build + JS/API/parity/security tests + Python tests
npm run preflight  # project-wide data & model integrity checks
```

The app picks up `.venv` automatically. To use a different interpreter, set `PYTHON_EXECUTABLE`.

## Deploy with Docker

```bash
cp .env.example .env          # set a strong APP_AUTH_PASSWORD (12+ chars)
docker compose up --build -d  # binds to 127.0.0.1:3000
```

The container runs as the unprivileged `node` user with a read-only root filesystem, all Linux capabilities dropped, `no-new-privileges` and `tini` as PID 1. SQLite history lives on the `artha-data` volume. For internet exposure, put it behind an HTTPS reverse proxy and set `ENABLE_HSTS=true`. See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Bind address |
| `NODE_ENV` | — | `production` makes `APP_AUTH_PASSWORD` mandatory |
| `APP_AUTH_USER` / `APP_AUTH_PASSWORD` | `research` / — | HTTP Basic auth for the UI and API (`/api/health` stays open) |
| `ENABLE_HSTS` | `false` | Send `Strict-Transport-Security` (HTTPS only) |
| `API_RATE_LIMIT` | `90` | API requests per client per minute |
| `PYTHON_EXECUTABLE` | auto | Interpreter override (`.venv` → `python3` otherwise) |
| `PYTHON_MAX_CONCURRENCY` / `PYTHON_TIMEOUT_MS` | `4` / `30000` | Calculation worker limits |
| `LLM_API_KEY`, `LLM_MODEL`, `LLM_API_URL` | — | Optional OpenAI-compatible chat endpoint (HTTPS only) |

To run natively with an env file: `node --env-file=.env backend/server.mjs`.

## Architecture

```
Browser (public/)  ──HTTP/JSON──▶  Node server (backend/server.mjs)  ──stdin/stdout──▶  Python engine
 app.js · engine.js                auth · rate limits · CSP · static     python_service.py
 retrieval.js (BM25)               origin checks · LLM validation        portable_finance.py (FCFF)
                                   bounded worker pool                   fundamental_analytics.py
                                                                         research_store.py (SQLite)
```

| Path | Responsibility |
|---|---|
| `src/portable_finance.py` | Dependency-free production FCFF model and sensitivity grid |
| `src/fundamental_analytics.py` | Ratios, CAPM/WACC, multiples, peer-implied values |
| `src/research_store.py` | Immutable SQLite valuation snapshots and input fingerprints |
| `src/equity_platform.py` | Independent pandas reference model (parity oracle) |
| `backend/python_service.py` | Validated JSON adapter around the Python engine |
| `backend/python_bridge.mjs` | Bounded, time-limited Python worker pool |
| `backend/server.mjs` | HTTP API, static hosting, security and optional LLM connector |
| `public/` | Desktop UI, browser packet builder and BM25 retriever |
| `data/source_snapshot.json` | Reviewed official evidence |
| `scripts/` | Build, CLI, BSE/market importers, preflight, packaging |
| `tests/`, `web-tests/` | Python unit, JS engine, API, parity, deployment and security tests |

More detail: [Architecture](docs/ARCHITECTURE.md) · [Model review](docs/MODEL_REVIEW.md) · [Learning guide](docs/LEARNING_GUIDE.md) · [RAG guide](docs/RAG_GUIDE.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Requirements audit](docs/REQUIREMENTS_AUDIT.md)

## API

| Method | Route | Body | Returns |
|---|---|---|---|
| `GET` | `/api/health` | — | Status, version, assistant mode (no secrets) |
| `GET` | `/api/companies` | — | Registered companies |
| `GET` | `/api/runs?companyId=infosys` | — | Saved SQLite snapshots |
| `POST` | `/api/valuation` | `{companyId, assumptions?, persist?, marketOverrides?}` | Full FCFF result (`422` if inputs are invalid) |
| `POST` | `/api/packet` | same as above | Research packet with sources and input manifest |
| `POST` | `/api/capital-cost` | `{inputs:{risk_free_rate, beta, …}}` | Cost of equity and WACC |
| `POST` | `/api/analytics` | `{companyId}` | Fundamental ratios |
| `POST` | `/api/retrieval` | `{companyId, question}` | Top BM25 source facts |
| `POST` | `/api/assistant` | `{companyId, question}` | Cited explanation (evidence or validated LLM) |

All `POST` routes require `Content-Type: application/json`, a same-origin `Origin` (when present) and a body ≤ 32 KB.

**CLI:** `npm run model -- --company infosys --scenario bull --output packet.json`

## Security

- HTTP Basic auth with constant-time comparison. Failed sign-ins are throttled (20 per 15 minutes per client).
- API rate limiting, 32 KB body cap, strict JSON-object validation and same-origin checks on writes.
- Strict CSP (`script-src 'self'`, `object-src 'none'`), `X-Frame-Options`, `Permissions-Policy`, COOP/CORP and optional HSTS.
- Path-traversal and null-byte protection on static files.
- Python runs with `shell:false` under a bounded worker pool, a timeout and an output-size cap. Internal errors are logged on the server, and clients get a generic message with no traceback.
- LLM keys never leave the server. Model output is validated against known citations and packet numbers before it is shown.
- `.env`, SQLite runtime data and build output are excluded from Git, Docker images and the source ZIP.

Found a vulnerability? Please open a private security advisory on GitHub rather than a public issue.

## Scope and limitations

This is an **educational research MVP, not investment advice.** The default case is a *retrospective* valuation dated 31 March 2026 that uses annual reports published later. Growth, WACC, margins, reinvestment, excess cash and employee-award dilution all need analyst review. March 2026 net shares are 404.6940812 crore, already net of treasury shares. Automatic ticker/news ingestion, FinBERT inference and full-PDF vector RAG are **not** implemented. See the [requirements audit](docs/REQUIREMENTS_AUDIT.md).

## Credits

Built on the original PBL project by [adityamakurwar97-cyber](https://github.com/adityamakurwar97-cyber/Ai-powered-Equity-reserch-and-Valuation-platform-). Released under the [MIT License](LICENSE).
