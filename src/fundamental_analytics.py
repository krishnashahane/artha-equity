"""Deterministic financial ratios and capital costs. Missing evidence stays None."""
from __future__ import annotations
import math
from statistics import median

def finite(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def divide(numerator,denominator):
    return numerator/denominator if finite(numerator) and finite(denominator) and denominator!=0 else None

def capital_cost(inputs:dict)->dict:
    """CAPM and market-value-weighted, after-tax WACC; no market inputs invented."""
    required=['risk_free_rate','beta','equity_risk_premium','cost_of_debt','tax_rate','market_equity_value','market_debt_value']
    errors=[f'{key} must be finite.' for key in required if not finite(inputs.get(key))]
    country=inputs.get('country_risk_premium',0)
    if not finite(country):errors.append('country_risk_premium must be finite.')
    if errors:raise ValueError(' '.join(errors))
    if not 0<=inputs['tax_rate']<=1:raise ValueError('tax_rate must be between 0 and 1.')
    for k in ['risk_free_rate','equity_risk_premium','cost_of_debt','country_risk_premium']:
        if not 0<=inputs.get(k,0)<1:raise ValueError(k+' must be a decimal rate between 0 and 1.')
    equity,debt=inputs['market_equity_value'],inputs['market_debt_value']
    if equity<=0 or debt<0:raise ValueError('Market equity must be positive and market debt non-negative.')
    cost_equity=inputs['risk_free_rate']+inputs['beta']*inputs['equity_risk_premium']+country
    ew,dw=equity/(equity+debt),debt/(equity+debt)
    wacc=cost_equity*ew+inputs['cost_of_debt']*(1-inputs['tax_rate'])*dw
    if wacc<=0:raise ValueError('The resulting WACC must be positive for this model.')
    return {'cost_of_equity':cost_equity,'after_tax_cost_of_debt':inputs['cost_of_debt']*(1-inputs['tax_rate']),'equity_weight':ew,'debt_weight':dw,'wacc':wacc,'status':'analyst_inputs','inputs':inputs,'warning':'Market inputs require dated sources. Country risk must not be added twice if already included in the equity risk premium.'}

def fundamental_ratios(annuals:list[dict],tax_rate=.25)->dict:
    """Use average balance-sheet denominators; label assumption-dependent measures."""
    if not finite(tax_rate) or not 0<=tax_rate<=1:raise ValueError('Invalid operating-tax assumption.')
    rows=[]
    for i,h in enumerate(annuals):
        p=annuals[i-1] if i else None
        revenue=h.get('revenue');ebit=h.get('operating_ebit');ni=h.get('net_income_attributable_owners')
        debt=h.get('debt');leases=h.get('lease_liabilities');cash=h.get('cash_and_cash_equivalents')
        da=h.get('depreciation_amortization');capex=h.get('capex')
        shares=h.get('weighted_average_diluted_shares')
        eps=divide(ni,shares/1e7 if finite(shares) else None)
        previous_eps=divide(p.get('net_income_attributable_owners'),p.get('weighted_average_diluted_shares')/1e7) if p and finite(p.get('weighted_average_diluted_shares')) else None
        average=lambda field:(h[field]+p[field])/2 if p and finite(h.get(field)) and finite(p.get(field)) else None
        prior_nwc=p['trade_receivables']-p['trade_payables'] if p else None
        nwc=h['trade_receivables']-h['trade_payables']
        delta=nwc-prior_nwc if prior_nwc is not None else None
        invested=lambda x:sum(x[k] for k in ['total_equity','debt','lease_liabilities'])-sum(x[k] for k in ['cash_and_cash_equivalents','current_investments','noncurrent_investments']) if all(finite(x.get(k)) for k in ['total_equity','debt','lease_liabilities','cash_and_cash_equivalents','current_investments','noncurrent_investments']) else None
        ic,prior_ic=invested(h),invested(p) if p else None
        avg_ic=(ic+prior_ic)/2 if ic is not None and prior_ic is not None else None
        rows.append({'fiscal_year':h['fiscal_year'],'revenue_growth':divide(revenue,p['revenue'])-1 if p and p['revenue'] else None,'gross_margin':divide(h.get('gross_profit'),revenue),'ebitda_margin':divide(ebit+da,revenue) if finite(ebit) and finite(da) else None,'operating_margin':divide(ebit,revenue),'net_margin':divide(ni,revenue),'roe':divide(ni,average('equity_attributable_owners')),'roa':divide(h.get('net_income'),average('total_assets')),'roic_assumption_based':divide(ebit*(1-tax_rate),avg_ic) if finite(ebit) else None,'current_ratio':divide(h.get('current_assets'),h.get('current_liabilities')),'debt_to_equity':divide(debt,h.get('equity_attributable_owners')),'debt_and_leases_to_equity':divide(debt+leases,h.get('equity_attributable_owners')) if finite(debt) and finite(leases) else None,'interest_coverage':divide(ebit,h.get('finance_cost')),'asset_turnover':divide(revenue,average('total_assets')),'receivable_days':divide(h.get('trade_receivables'),revenue)*365 if revenue else None,'diluted_eps':eps,'eps_growth':eps/previous_eps-1 if eps is not None and previous_eps else None,'cfo_less_capex':h['cash_flow_operating']-capex,'fcff_assumed_tax':ebit*(1-tax_rate)+da-capex-delta if delta is not None else None})
    first,last=annuals[0],annuals[-1]
    years=last['fiscal_year']-first['fiscal_year']
    return {'unit':'ratios are decimals unless labelled; money INR crore; EPS INR','annuals':rows,'revenue_cagr':(last['revenue']/first['revenue'])**(1/years)-1 if years>0 and first['revenue']>0 else None,'definitions':{'roe':'Owner profit / average equity attributable to owners; first period unavailable without prior balance.','roa':'Consolidated group profit / average total assets.','roic_assumption_based':'EBIT × (1 − assumed tax) / average(equity + debt + leases − cash − investments). Requires review of operating cash, non-operating assets and lease consistency.','gross_margin':'Unavailable when a sourced cost-of-sales/gross-profit definition is absent.','cfo_less_capex':'Reported CFO less capex; distinguish this from modeled FCFF.','fcff_assumed_tax':'Historical EBIT using an analyst operating-tax assumption; not reported cash flow.'},'operating_tax_assumption':tax_rate}

def relative_metrics(peer:dict)->dict:
    price,shares=peer.get('price'),peer.get('net_shares_crore')
    result={'id':peer.get('id'),'market_cap':None,'enterprise_value':None,'pe':None,'pb':None,'ps':None,'ev_ebitda':None,'ev_ebit':None,'ev_revenue':None}
    if not finite(price) or price<=0 or not finite(shares) or shares<=0 or peer.get('price_date')!=peer.get('share_date'):return result
    cap=price*shares;result['market_cap']=cap
    for key,denominator in [('pe',peer.get('net_income')),('pb',peer.get('book_equity')),('ps',peer.get('revenue'))]:
        result[key]=divide(cap,denominator) if finite(denominator) and denominator>0 else None
    if all(finite(peer.get(k)) and peer[k]>=0 for k in ['debt','leases','nci','cash']):
        ev=cap+peer['debt']+peer['leases']+peer['nci']-peer['cash'];result['enterprise_value']=ev
        for key,denominator in [('ev_ebitda',peer.get('ebitda')),('ev_ebit',peer.get('ebit')),('ev_revenue',peer.get('revenue'))]:result[key]=divide(ev,denominator) if finite(denominator) and denominator>0 else None
    return result

def implied_peer_values(peers:list[dict],target:dict)->dict:
    """Apply positive comparable multiples; unavailable peer evidence never becomes 0."""
    metrics=[relative_metrics(p) for p in peers];out={}
    for multiple,base,is_ev in [('pe','net_income',False),('pb','book_equity',False),('ps','revenue',False),('ev_ebitda','ebitda',True),('ev_ebit','ebit',True),('ev_revenue','revenue',True)]:
        values=[m[multiple] for m in metrics if finite(m[multiple]) and m[multiple]>0]
        med=median(values) if values else None;equity=None
        if med is not None and finite(target.get(base)):
            value=med*target[base]
            if is_ev:
                if all(finite(target.get(k)) for k in ['debt','leases','nci','cash']):equity=value-target['debt']-target['leases']-target['nci']+target['cash']
            else:equity=value
        out[multiple]={'peer_count':len(values),'median_multiple':med,'implied_equity_value':equity,'implied_value_per_share':divide(equity,target.get('net_shares_crore'))}
    return out
