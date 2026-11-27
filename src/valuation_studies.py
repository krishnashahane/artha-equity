"""Bounded scenario studies; every financial calculation stays in Python."""
from __future__ import annotations
import random
from portable_finance import calculate, number, validate

SEED = 1729


def bridge(result: dict, assumptions: dict) -> list[dict]:
    """Return signed steps and running totals for a presentation-only waterfall."""
    steps = [('Enterprise value', result['enterpriseValue'], True),
             ('Excess cash', assumptions['excessCash'], False),
             ('Debt', -assumptions['debt'], False),
             ('Leases', -assumptions['leases'], False),
             ('NCI', -assumptions['nci'], False),
             ('Equity value', result['equityValue'], True)]
    total = 0; out = []
    for label, value, is_total in steps:
        start = 0 if is_total else total
        total = value if is_total else total + value
        out.append(dict(label=label, value=value, start=start, end=total, total=is_total))
    return out


def monte_carlo(company: dict, assumptions: dict, observations: list, options: dict) -> dict:
    """Sample independent bounded uniform assumptions with a local fixed RNG.

    Spreads are absolute decimal rates, not relative percentages. These are
    illustrative analyst distributions, not estimated confidence intervals.
    """
    validate(company, assumptions)
    count = options.get('iterations', 1000)
    if isinstance(count, bool) or not isinstance(count, int) or not 100 <= count <= 5000:
        raise ValueError('iterations must be an integer between 100 and 5000.')
    spreads = {k: options.get(k, default) for k, default in [('growthSpread', .02), ('marginSpread', .01), ('waccSpread', .01)]}
    if any(not number(v) or not 0 <= v <= .2 for v in spreads.values()):
        raise ValueError('Spreads must be finite decimal rates between 0 and 0.2.')
    margins = assumptions.get('margins', [assumptions['margin']] * 5)
    if (min(assumptions['growth']) - spreads['growthSpread'] <= -1
            or min(margins) - spreads['marginSpread'] < -1 or max(margins) + spreads['marginSpread'] > 1
            or assumptions['wacc'] - spreads['waccSpread'] <= max(0, assumptions['terminalGrowth'])
            or assumptions['wacc'] + spreads['waccSpread'] >= 1):
        raise ValueError('Sampling bounds violate growth, margin or WACC constraints; narrow the spreads.')
    rng = random.Random(SEED); values = []
    for _ in range(count):
        draft = {**assumptions,
                 'growth': [rng.uniform(g-spreads['growthSpread'], g+spreads['growthSpread']) for g in assumptions['growth']],
                 'margins': [rng.uniform(m-spreads['marginSpread'], m+spreads['marginSpread']) for m in margins],
                 'wacc': rng.uniform(assumptions['wacc']-spreads['waccSpread'], assumptions['wacc']+spreads['waccSpread'])}
        values.append(calculate(company, draft, observations, False)['perShare'])
    values.sort()
    def percentile(p: float) -> float:
        position = (count-1)*p; lower = int(position); upper = min(count-1, lower+1)
        return values[lower] + (values[upper]-values[lower])*(position-lower)
    lo, hi = values[0], values[-1]; width = (hi-lo)/20 if hi != lo else 1
    histogram = [dict(low=lo+i*width, high=lo+(i+1)*width, count=0) for i in range(20)]
    for value in values:
        histogram[min(19, int((value-lo)/width))]['count'] += 1
    return dict(valid=True, calculationAuthority='python', seed=SEED, iterations=count,
                p5=percentile(.05), p50=percentile(.5), p95=percentile(.95), histogram=histogram,
                distribution='Independent uniform annual growth and margins; uniform WACC.', spreads=spreads,
                warning='Illustrative scenario distribution, not a probability of investment returns or a confidence interval.')


def reverse_dcf(company: dict, assumptions: dict, observations: list, price: float) -> dict:
    """Bisect a flat five-year growth assumption over [-50%, 100%].

    Hold margins, discount rate, terminal growth and bridge constant. Reject
    non-monotonic scenarios instead of claiming an ambiguous implied growth.
    The supplied price is a hypothetical target, never a verified market quote.
    """
    if not number(price) or price <= 0:
        raise ValueError('price must be a positive finite user-supplied value.')
    def value(growth: float) -> float:
        return calculate(company, {**assumptions, 'growth': [growth]*5}, observations, False)['perShare']
    lo, hi = -.5, 1.
    grid = [value(lo + (hi-lo)*i/100) for i in range(101)]
    if any(b <= a for a, b in zip(grid, grid[1:])):
        raise ValueError('This scenario is not monotonically increasing over the search interval; implied growth is unavailable.')
    if not grid[0] <= price <= grid[-1]:
        raise ValueError('Target price is outside the solvable growth interval [-50%, 100%].')
    for _ in range(80):
        mid = (lo+hi)/2
        if value(mid) < price: lo = mid
        else: hi = mid
    growth = (lo+hi)/2; implied = value(growth)
    if abs(implied-price) > max(1e-6, price*1e-10):
        raise ValueError('Reverse DCF did not converge; implied growth is unavailable.')
    return dict(valid=True, calculationAuthority='python', impliedGrowth=growth, price=price,
                solvedPerShare=implied, residual=implied-price, iterations=80, bounds=[-.5, 1.],
                priceStatus='user_supplied_hypothetical',
                warning='Flat annual growth implied by the supplied price with all other assumptions held constant; not a market quote.')
