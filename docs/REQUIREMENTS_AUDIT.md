# Review of the supplied master prompt

The supplied prompt is a strong functional and teaching specification. It is broader than the first desktop workbench. This document records the real implementation boundary so future work is not confused with completed features.

## Decisions applied now

1. **Desktop only.** No mobile layout or mobile navigation drawer. The supplied terminal reference was redesigned into a spacious light theme with three primary areas.
2. **Python is authoritative.** The local HTTP application and CLI call `backend/python_service.py`; FCFF, sensitivity, capital costs, fundamental ratios and comparable calculations use deterministic Python functions. The hosted static site is explicitly an interface preview. Its supported cases are compiled by Python during the build; custom calculations require the complete application.
3. **Preserve working code.** The validated Python core and original learning notebook remain. New services wrap and extend them rather than replacing the source data boundary.
4. **No invented inputs or results.** Missing prices, unsupported ratios and unresolved dilution remain unavailable/provisional. No FinBERT, RAG or predictive-model accuracy is claimed without an actual experiment.
5. **Proceed within current authorization.** The prompt's generic instruction to restart planning and request Phase 1 approval is guidance for a new project. The user has already authorized this build; routine implementation continues. Ask only when a real missing credential, inaccessible source or unresolved choice blocks the next step.

## Requirement coverage

| Requirement | Current status | Remaining acceptance condition |
|---|---|---|
| Company/ticker search | Registered company search and reviewed snapshot import | Automatic ticker resolution and supported-universe policy |
| Company/price history | Infosys snapshot and manual market import | Working dated price acquisition, caching and corporate-action policy |
| Three financial statements | Official Infosys FY24–FY26 selected lines, reconciled | Broader companies and notes coverage |
| Normalization/provenance | Implemented | Add provider-specific reconciliation as ingestion expands |
| Historical charts | Desktop Company view with chart modes implemented | Expand reviewed company coverage |
| Fundamental ratios | Python library and API implemented | Gross margin/interest coverage only when source fields exist |
| FCFF/DCF | Implemented and tested | Research assumptions and lease/terminal economics before investment use |
| CAPM/WACC | Python calculator and API implemented | Dated market-sourced inputs before investment use |
| Relative valuation | Python P/E, P/B, P/S, EV/EBITDA, EV/EBIT, EV/revenue and implied values | Load valid comparable prices, shares and missing balance inputs |
| Scenarios/sensitivity | Integrated with Python API and desktop UI | Research assumptions before investment use |
| News ingestion | Not implemented | Real provider/feed with timestamps, deduplication and source URLs |
| FinBERT | Not implemented | Actual pretrained model inference, per-item probabilities and labelled evaluation |
| LLM explanations | Optional local-server connector with evidence fallback | User-configured provider/model, live call verification and evaluation |
| Structured-fact retrieval | BM25 implemented and tested | Expanded paraphrase/date/company evaluation |
| Full annual-report RAG | Not implemented | PDF extraction, page-aware chunks, embeddings/vector store and retrieval evaluation |
| Research report | Structured packet and printable report | Source-grounded thesis/catalysts and final LLM memo evaluation |
| Desktop UI | Light desktop redesign implemented; three main areas and details on demand | User acceptance and broader usability study |
| PDF export | Browser print-to-PDF | Dedicated server PDF only if needed |
| SQLite | Local immutable valuation snapshots and history API implemented | Database lifecycle/cache migrations as ingestion expands |
| Academic submission | Learning/model/architecture guides | Literature review, full PBL report, presentation and measured experiments |

## Clarifications the master prompt should retain

- Treat free API data as a prototype feed, not automatically exchange-verified or redistribution-licensed data. Record provider, access time, fiscal basis, currency, adjustments and review status.
- Distinguish a live research run from a retrospective case study. Information cutoff cannot use future publication dates in a point-in-time analysis.
- Define FCFF suitability. Banks and insurers need another valuation methodology; unsupported sectors should be blocked, not forced through this model.
- Confidence must mean measured data coverage, retrieval/citation performance or an explicit valuation range. An LLM's self-rated confidence is not financial accuracy.
- Share split/bonus/buyback adjustments must align EPS, outstanding shares, price date and fiscal period. Do not mix weighted-average EPS shares with period-end valuation shares.
- FinBERT sentiment is a text-classification result, not an expected-return model. Use a labelled held-out evaluation set and disclose licensing/sampling limits.
- RAG evaluation needs known relevant pages, unsupported questions, company/date isolation and unit/number checks. A successful demo is not a measured faithfulness score.
- PDF uploads need size/type limits, extraction failure handling and source-text prompt-injection controls. Keep provider credentials on the server.
- Define deadlines as estimates conditional on team hours, data availability and model/API access. Financial correctness and source review remain release gates.

## Recommended module interfaces

| Owner | Input | Output | Boundary |
|---|---|---|---|
| Sahil — ingestion | Ticker + requested as-of date | Raw records, normalized facts, provider/provenance metadata | No invented missing values |
| Shlok — analytics | Validated facts + explicit assumptions | Ratios, CAPM/WACC, DCF, sensitivity, relative values | Python only |
| Ethan — AI/NLP | Approved facts/documents/news + model configuration | Sentiment probabilities, retrieved evidence, cited memo, evaluation artifacts | AI never replaces authoritative numbers |
| Mandar — desktop UI | Versioned API payloads and the user's design reference | Views, controls, loading/error/unavailable states | Presentation layer preserves source/warning semantics |
| Yash — submission/testing | Module contracts, real outputs and verified references | Acceptance matrix, report, presentation, viva guide | No invented citations or experiment scores |

## Compressed plan with dependencies

Planning assumption: each member can contribute 2–3 focused hours per day. These are planning estimates, not completion promises.

| Phase | Owners | Deliverable | Gate | Estimate |
|---|---|---|---|---|
| Foundation repair | Shlok + Sahil | Reviewed inputs, Python contracts, analytics, SQLite | Tests and manual calculation examples pass | Existing foundation; 1–2 team days for handoff |
| Working MVP | Sahil + Shlok + Mandar; Ethan for provider setup | Ticker ingestion, Python analytics, desktop reference applied, cited LLM output | One reproducible non-financial-company run | 3–5 further team days |
| Advanced NLP/RAG | Ethan; Sahil for documents/news | Actual FinBERT and page-aware vector RAG | Labelled inference/retrieval evaluation recorded | 5–10 further team days, depending on model access |
| Submission | Yash + all | Report, presentation, viva and demo script | Every claimed result linked to a real run | 2–3 overlapping team days |

Critical path: valid source acquisition → Python analysis → integrated desktop output → actual AI/model evaluation. The UI reference can be applied while AI/data work proceeds. Broad US-market support, stock-price prediction and multi-agent orchestration can wait.

## Next phase boundary

Keep the desktop design provisional until the user supplies the UI/UX reference. Continue backend modules independently. Ask for the chosen LLM/provider configuration only when a real call needs it; never ask for an API secret in chat. Use local environment configuration for secrets.

## Release 1.2 deployment boundary

The core application is packaged with a Dockerfile, Compose configuration, production shared-password authentication and persistent SQLite storage. The direct Node/Python runtime and browser flows are verified. Docker itself was unavailable here, so an image build was not executed. The hosted Site remains a static desktop preview; no live Python hosting is implied. See DEPLOYMENT.md.
