# Desktop UI and UX

Artha uses a light silver canvas, white surfaces, large system typography and one blue action color. The goal is a readable research sequence with useful space around each decision. The application is desktop only, minimum width 1180px; no mobile layout is implemented.

## Three primary areas

Company introduces the reviewed business and reported history. Revenue, profit and cash flow share one chart area; selected financial statements and ratios expand when requested.

Valuation begins with the scenario value and assumptions. Users can choose base/bull/bear, edit a custom case in the complete Python application, build WACC from CAPM inputs and open FCFF, sensitivity or the equity bridge. Peer analysis is a subview. Additional multiples remain inside a disclosure.

Research explains loaded facts and model outputs. Supported evidence answers show actual source references and retrieved facts. The optional live provider is identified separately from evidence mode.

## Utility workflows

Evidence opens official source links, methodology, twelve reconciliation checks and run history. Save records a local scenario and asks the Python API to persist the run in the full app. Export offers a research packet, forecast CSV, print/PDF and the source project. Market import requires reviewed official BSE evidence and matching dated shares.

The static preview uses Python-compiled base/bull/bear cases. Controls requiring a Python server explain how to open the complete app rather than simulating a calculation.

## Interaction and accessibility

Labelled controls, visible focus, dialog focus containment, Escape-to-close, slash-to-search, a skip link, reduced motion and A4 print styles are implemented. Tables have clear units and internal horizontal overflow when needed. Browser checks cover desktop navigation, scenarios, validation, CAPM, evidence answers and exports. This is not a formal accessibility certification.

## Persistence and trust

Scenario drafts and activity live in browser storage. Explicit saved runs use immutable SQLite snapshots in the complete app. Neither is a multi-user permission/audit system. Publication dates, source links, provisional warnings and unavailable market comparisons remain attached to the analysis.
