# Scenario studies

`margins` is an optional five-element decimal-rate array alongside five annual
`growth` rates. A scalar `margin` remains the fallback for older scenarios. The
fifth annual margin is used to rebuild terminal FCFF. All calculations are Python.
The assumptions dialog exposes each annual growth and operating margin.

`POST /api/monte-carlo`: `{companyId, assumptions?, options?}`. Options are
`iterations` (integer 100–5000, default 1000), `growthSpread` (default .02),
`marginSpread` (.01), `waccSpread` (.01). Spreads are absolute decimal rates in
[0,.2]. Each annual growth and margin and the scenario WACC are drawn independently
from uniform ranges around the active assumptions. All sampling bounds must satisfy
the model constraints. Fixed local seed 1729; Python linearly interpolates P5,
P50, P95 and supplies 20 histogram bins. No samples are silently discarded.
These illustrative distributions are not calibrated investment probabilities.

`POST /api/reverse-dcf`: `{companyId, assumptions?, price}` with a positive finite
hypothetical price in INR/share. Python solves one flat five-year growth rate in
[-50%,100%] with 80 bisections. All other inputs remain constant. A 101-point
monotonicity screen and bracket test reject unsuitable scenarios; this screen is
not a mathematical proof of global monotonicity for arbitrary cash-flow models.
The response includes `impliedGrowth`, `solvedPerShare`, `residual`, and explicitly
labels the price `user_supplied_hypothetical`. It never enables market upside.

Both routes inherit authentication, same-origin, rate, body and worker limits.
Invalid model inputs return 422 with safe validation text. Bridge steps returned
with valuation contain Python-calculated signed movements and running totals.
