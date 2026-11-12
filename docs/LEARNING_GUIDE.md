# Understand your PBL, then explain it

This guide connects the finance to the software. Read it in order. Each section explains the idea before pointing to its implementation.

## 1. A research platform is a chain of evidence

A stock valuation is the end of a chain: official report → reviewed financial facts → assumptions → calculations → interpretation. If an early link is weak, a polished chart cannot fix the answer.

This project separates historical facts from assumptions. Reported FY26 revenue is a fact backed by a document. FY27 revenue growth is an analyst assumption. The UI labels the distinction, and exports keep both.

Open `data/source_snapshot.json` first. Find one FY26 revenue observation, its units, report URL and page. Then compare it with the generated row in `data/raw/infosys_source_records.csv` and the browser bundle in `data/companies.json`.

**Check yourself:** Why would multiplying a USD-million value by 1 not make it an INR-crore value, even if the arithmetic passes?

## 2. Units are part of the number

One crore is 10,000,000. Financial statement amounts are stored in INR crore. Absolute share counts are divided by 10,000,000 into crore shares. Therefore, INR crore divided by crore shares equals INR per share.

The Python validator checks both arithmetic and declared units. It rejects unsupported currency labels and inconsistent conversion factors. The browser rejects company snapshots labelled with a different currency/unit.

See `src/equity_platform.py`, `validate_source_record_rows`, and `public/engine.js`, `validateCompany`.

## 3. Reconciliation asks whether the statements agree

Before forecasting, four accounting identities are checked for every historical year:

1. Assets equal equity plus liabilities.
2. Operating, investing and financing cash flows sum to reported cash movement.
3. Opening cash plus cash movement plus exchange effects equals closing cash.
4. Closing cash in the cash-flow statement matches the balance sheet.

These checks catch transcription, sign and period errors. They do not certify every note in the annual report. The ₹1 crore tolerance permits rounded statements; there are no balancing plugs.

Run `python scripts/preflight.py` or inspect Audit trail. Try changing one test fixture's assets by ₹10 crore and predict the result before running the tests.

## 4. Why FCFF exists

Accounting profit includes non-cash expenses and does not directly show reinvestment. Free cash flow to the firm estimates operating cash available to all capital providers:

`FCFF = EBIT × (1 − operating tax rate) + D&A − capex − change in operating NWC`

EBIT measures operating earnings before financing costs. We apply an operating tax assumption to obtain NOPAT. Depreciation is added back because it is non-cash. Capital expenditure and additional operating working capital consume cash.

The educational NWC definition is receivables minus payables. A professional model must assess contract assets, deferred revenue and other material operating balances. This project's limitation is visible in the model and source definitions.

Follow one forecast row in `public/engine.js`, `calculate`: revenue → EBIT → NOPAT → D&A/capex → NWC change → FCFF. Then inspect the same row in Valuation studio.

**Check yourself:** If capex increases by ₹100 crore and every other input stays unchanged, what happens to that year's FCFF?

## 5. Discounting converts future cash to a valuation-date amount

A rupee received later has a different value from a rupee received today. WACC is the discount rate applied to operating cash flows. The model computes cash-flow dates at March year ends and uses actual days divided by 365.25:

`PV = FCFF / (1 + WACC) ^ time_in_years`

The default effective date is March 31, 2026. The source statements were published later, so the study is explicitly retrospective. It does not claim those facts were available on March 31. `point_in_time` mode rejects facts published after its cutoff and disallows a cutoff later than the valuation date.

The annual model is designed around a financial year-end base. For a real interim-date valuation, build a reviewed stub-period forecast and roll forward the bridge; changing a date alone does not establish an accurate interim forecast.

## 6. Terminal value and reinvestment must agree

The explicit forecast covers five years, but a going business can produce cash beyond that. The perpetual-growth method estimates the value after the forecast:

`Terminal value = next-year FCFF / (WACC − terminal growth)`

WACC must exceed terminal growth. When terminal growth changes, next-year revenue and working-capital reinvestment change too. The engine rebuilds the terminal year for every sensitivity cell instead of merely scaling the old FCFF.

The interface shows the terminal-value contribution. A large contribution makes the conclusion especially sensitive to long-term assumptions. The default ratios can produce negative terminal reinvestment; the application flags this for review rather than claiming a fully researched stable-growth case.

**Check yourself:** Why can raising terminal growth without increasing reinvestment overstate value?

## 7. Enterprise value is not equity value

Discounted FCFF estimates operating enterprise value. The equity bridge adds assessed excess cash and subtracts debt, lease liabilities and non-controlling interests.

Not all reported cash is distributable excess. Restricted balances and an operating reserve require review. The default zero excess-cash allowance is an explicit educational assumption, not a claim that Infosys has no cash.

Equity value is divided by an appropriate share denominator. The March 2026 source reports 4,046,940,812 net outstanding shares. That count already excludes treasury shares. Subtracting treasury again would reduce the denominator twice and overstate per-share value.

Employee-award period-end dilution is not established, so the default per-share output remains provisional. Weighted-average diluted EPS shares are a different measurement and do not silently replace it.

## 8. Comparable companies need consistent definitions

A comparable valuation asks what investors pay for similar businesses relative to earnings or operating performance. This app implements:

- `P/E = market capitalization / net income attributable to shareholders`
- `EV / EBIT = enterprise value / reported operating profit`
- `EV / revenue = enterprise value / reported revenue`

It first needs a reviewed direct BSE price and compatible shares. Enterprise-value multiples additionally need a complete bridge. Missing evidence appears as unavailable; no quote is fabricated.

The peer table uses reported EBIT and owner profit consistently. Adjusted headline profit can exclude restructuring or Labour Codes charges. The committed snapshot documents those differences for TCS, HCLTech and Wipro.

## 9. Python owns authoritative financial calculations

The final functional specification requires deterministic Python finance. `backend/python_service.py` calls the dependency-free production core in `src/portable_finance.py` and returns a versioned result to the local HTTP application. The browser renders that result, including its Python sensitivity matrix and peer metrics. The Node CLI also calls the Python adapter through a bounded stdin/stdout subprocess.

`src/fundamental_analytics.py` implements ratios, CAPM/WACC and comparable/implied values. `src/research_store.py` persists immutable valuation snapshots in local SQLite. A database stores rows durably so a browser refresh does not erase the analysis history.

The hosted static page uses Python-compiled base/bull/bear cases and evidence answers. Custom inputs need the complete Python application. The original pandas model remains as an independent notebook benchmark; the browser does not calculate financial results.

A service contract separates calculation from presentation: valid results contain forecasts, valuation, assumptions, sources/warnings and `calculationAuthority: python`; invalid results contain validation errors. This lets the UI change without changing the financial mathematics.

## 10. What the research assistant does

A BM25 retriever ranks page-linked financial facts by query-word matches, rarity and document-length normalization. See `docs/RAG_GUIDE.md`. Evidence mode routes supported questions to explanations built from the loaded facts and calculations. It returns actual source references. It does not browse, train a model, use embeddings or pretend to be an LLM.

The local backend includes an optional language-model connector. An API key and model name must be configured server-side. The backend sends a deterministic research packet, requires existing source IDs, checks numerical claims against the packet, and falls back to evidence mode when the response fails validation. These checks reduce errors; they do not establish that every model-generated sentence is correct.

A production document-RAG system would add page-aware extraction, chunking, retrieval evaluation and a reviewed corpus. The implemented assistant's scope is the structured source snapshot. Do not describe it in your viva as a trained financial model.

## 11. How the UI supports the analyst

Company explains the reported business. Valuation explores assumptions, FCFF and peers. Research explains the evidence. Sources, checks and run history open on demand, keeping three main areas and more space on screen.

Scenarios and activity persist in this browser's local storage. That is useful for a student demo but is not a shared database or tamper-proof audit log. Export JSON to preserve a portable record.

The hosted static edition displays Python-compiled results in the browser. `npm start` provides custom Python calculation, the local HTTP API and the optional LLM connector. No secret is bundled in the published site.

## 12. A five-minute viva demonstration

1. Open Company and explain the source periods, units and retrospective label.
2. Open Evidence → Sources and follow the FY26 official statement.
3. Show all 12 reconciliation checks in Evidence → Checks.
4. In Valuation studio, raise WACC and predict the direction before observing the new value.
5. Increase capex and explain the effect on cash flow.
6. Save a scenario and show its assumptions in an exported JSON packet.
7. Explain why missing market prices leave peer multiples unavailable.
8. Ask the assistant about the share denominator and explain the treasury correction.
9. Finish with the known limitations and the evidence needed to resolve them.

Your best next learning exercise: explain, without reading the code, how revenue growth can increase both operating profit and the need for working capital.
