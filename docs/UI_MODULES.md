# Native UI modules

The browser loads ES modules directly with no bundler or runtime dependency.

| Module | Responsibility |
|---|---|
| app.js | Navigation, actions, company selection and event binding |
| state.js | Shared state, live issuer bindings, display formatting and local storage |
| views.js | Company, valuation, research and print templates |
| dialogs.js | Forms, evidence, scenarios, exports and study dialogs |
| charts.js | Position supplied values in accessible SVGs; no valuation formulas |
| api.js | Same-origin requests, valuation refresh and evidence conversations |
| focus.js | Testable keyboard focus containment |
| engine.js | Clone/default-input and packet serialization helpers only |

Views and dialogs import navigation callbacks through native live bindings.
Their declarations perform no rendering during module initialization. Only app.js
boots the interface, after initialization. Request sequence IDs discard stale
valuation responses. Source and precomputed values belong to the selected issuer.

The old JavaScript calculation model is retained only in
`web-tests/reference_engine.mjs` as an independent regression benchmark. Every
existing assertion and tolerance is retained; no calculation code is shipped in
public/engine.js. Production Node calls the Python bridge. The pandas engine is
also an independent test/notebook benchmark; production works with Python `-S`.
