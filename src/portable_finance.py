"""Dependency-free Python valuation for the deployable HTTP service.

The notebook's pandas implementation remains an independent numerical benchmark.
This module uses the same reviewed facts and formulas with Python's standard library.
"""
from __future__ import annotations
from datetime import date
from math import isfinite

def number(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and isfinite(value)

def iso(value):
    try:return isinstance(value,str) and date.fromisoformat(value).isoformat()==value
    except (ValueError,TypeError):return False

def validate(company,a):
    if company.get('currency')!='INR' or company.get('unit')!='INR crore':raise ValueError('Financial data must be normalized to INR crore.')
    if any(word in company.get('sector','').lower() for word in ['bank','insurance','financial services']):raise ValueError('This FCFF model does not support financial institutions.')
    rows=company.get('historical',[])
    if len(rows)<3:raise ValueError('Three annual financial periods are required.')
    years=[r.get('year') for r in rows]
    if any(not isinstance(y,int) or (i and y!=years[i-1]+1) for i,y in enumerate(years)):raise ValueError('Financial periods must be consecutive and ascending.')
    fields=['revenue','ebit','netIncome','da','capex','receivables','payables','cash','assets','equity','liabilities','cfo','cfi','cff','netCashChange','fx','openingCash','closingCash']
    if any(not number(r.get(k)) for r in rows for k in fields):raise ValueError('Required source statement fields must be finite numeric values.')
    if any(r['revenue']<=0 for r in rows):raise ValueError('Historical revenue must be positive.')
    if not isinstance(a.get('growth'),list) or len(a['growth'])!=5 or any(not number(g) or g<=-1 for g in a['growth']):raise ValueError('Five finite annual growth assumptions above −100% are required.')
    for k in ['wacc','terminalGrowth','margin','tax','daRatio','capexRatio','nwcRatio','excessCash','debt','leases','nci']:
        if not number(a.get(k)):raise ValueError(k+' must be a finite numeric value.')
    if not 0<a['wacc']<1:raise ValueError('WACC must be between 0% and 100%.')
    if not -1<a['terminalGrowth']<a['wacc']:raise ValueError('Terminal growth must be below WACC and above −100%.')
    if not -1<=a['margin']<=1 or not 0<=a['tax']<=1:raise ValueError('Margin or tax is outside the permitted range.')
    if any(a[k]<0 for k in ['daRatio','capexRatio','excessCash','debt','leases','nci']):raise ValueError('Reinvestment ratios and bridge deductions cannot be negative.')
    if not iso(a.get('valuationDate')) or not iso(a.get('informationCutoff')):raise ValueError('Dates must use valid YYYY-MM-DD values.')
    if a.get('studyMode') not in ['retrospective','point_in_time']:raise ValueError('Choose retrospective or point_in_time study mode.')
    if a['studyMode']=='point_in_time' and a['informationCutoff']>a['valuationDate']:raise ValueError('A point-in-time cutoff cannot be later than the valuation date.')
    sources={s['id']:s for s in company.get('sources',[])}
    if not sources:raise ValueError('Source documents are required.')
    for h in rows:
        if not h.get('sourceIds') or any(sid not in sources for sid in h['sourceIds']):raise ValueError('A financial period has no source document.')
        if any(sources[sid]['publicationDate']>a['informationCutoff'] for sid in h['sourceIds']):raise ValueError('Financial evidence was published after the information cutoff.')
    for fact in company.get('facts',[]):
        if fact.get('unit') not in ['INR crore','crore shares'] or not number(fact.get('value')) or not fact.get('pdfPage'):raise ValueError('Source facts require correct units, finite amounts and page references.')

def reconcile(company):
    checks=[]
    for h in company['historical']:
        for label,lhs,rhs in [
            ('Assets = equity + liabilities',h['assets'],h['equity']+h['liabilities']),
            ('Cash flow subtotals',h['cfo']+h['cfi']+h['cff'],h['netCashChange']),
            ('Opening cash to closing cash',h['openingCash']+h['netCashChange']+h['fx'],h['closingCash']),
            ('Cash flow to balance sheet',h['closingCash'],h['cash']),
        ]:
            residual=lhs-rhs;checks.append(dict(year=h['year'],label=label,residual=residual,status='pass' if abs(residual)<=1 else 'fail'))
    return checks

def calculate(company,a,share_observations=None,include_sensitivity=True):
    validate(company,a);checks=reconcile(company)
    if any(r['status']!='pass' for r in checks):raise ValueError('Statement reconciliations must pass before valuation.')
    candidates=[s for s in (share_observations or []) if s['effective_date']==a['valuationDate']]
    if len(candidates)==1:
        share=candidates[0]
        if share['publication_date']>a['informationCutoff']:raise ValueError('Share observation was published after the information cutoff.')
        shares=share.get('fully_diluted_period_end_shares') or share['net_outstanding_shares'];shares/=1e7
    elif company['shares']['date']==a['valuationDate']:
        shares=company['shares'].get('fullyDilutedCrore') or company['shares']['netCrore']
    else:raise ValueError('A dated share observation matching the valuation date is required.')
    if not number(shares) or shares<=0:raise ValueError('The share denominator must be finite and positive.')
    base=company['historical'][-1];previous_revenue=base['revenue'];previous_nwc=base['receivables']-base['payables'];forecast=[]
    for i,growth in enumerate(a['growth']):
        year=base['year']+i+1;time=(date(year,3,31)-date.fromisoformat(a['valuationDate'])).days/365.25
        if time<=0:raise ValueError('Refresh the financial base before valuing a later period.')
        revenue=previous_revenue*(1+growth);ebit=revenue*a['margin'];nopat=ebit*(1-a['tax']);da=revenue*a['daRatio'];capex=revenue*a['capexRatio'];nwc=revenue*a['nwcRatio'];delta=nwc-previous_nwc;fcff=nopat+da-capex-delta;discount=(1+a['wacc'])**(-time)
        if not all(number(x) for x in [revenue,ebit,nopat,da,capex,nwc,delta,fcff,discount,fcff*discount]):raise ValueError('Forecast assumptions exceed the finite calculation range.')
        forecast.append(dict(year=year,revenue=revenue,ebit=ebit,nopat=nopat,da=da,capex=capex,nwc=nwc,deltaNwc=delta,fcff=fcff,time=time,discountFactor=discount,pv=fcff*discount))
        previous_revenue,previous_nwc=revenue,nwc
    last=forecast[-1];tr=last['revenue']*(1+a['terminalGrowth']);reinvestment=tr*a['capexRatio']-tr*a['daRatio']+tr*a['nwcRatio']-last['nwc'];tfcff=tr*a['margin']*(1-a['tax'])-reinvestment;tv=tfcff/(a['wacc']-a['terminalGrowth']);tpv=tv*last['discountFactor'];fpv=sum(r['pv'] for r in forecast);ev=fpv+tpv;equity=ev+a['excessCash']-a['debt']-a['leases']-a['nci']
    if not all(number(x) for x in [tr,tfcff,tv,tpv,fpv,ev,equity,equity/shares]):raise ValueError('Terminal assumptions exceed the finite calculation range.')
    warnings=[]
    if a['studyMode']=='retrospective' and a['informationCutoff']>a['valuationDate']:warnings.append('Retrospective study: later-published annual reports are used. This is not a point-in-time trading signal.')
    if not company['shares'].get('fullyDilutedCrore'):warnings.append('Period-end employee-award dilution is unavailable. Per-share value uses sourced net outstanding shares and remains provisional.')
    if not company.get('bridgeReviewed'):warnings.append('Excess cash and bridge assumptions require an analyst review. A zero cash allowance is an explicit scenario assumption.')
    warnings.append('No same-date direct BSE close is loaded. Market upside and downside are unavailable.')
    if reinvestment<0:warnings.append('Terminal reinvestment is negative. Review sustainable growth and return-on-capital economics before relying on the model.')
    result=dict(valid=True,errors=[],forecast=forecast,terminalRevenue=tr,terminalFcff=tfcff,terminalValue=tv,terminalPV=tpv,forecastPV=fpv,enterpriseValue=ev,equityValue=equity,perShare=equity/shares,shares=shares,terminalContribution=tpv/ev if ev>0 else None,market=None,upside=None,warnings=warnings,reconciliations=checks,status='provisional' if warnings else 'ready',modelVersion='1.2.0',calculationAuthority='python',assumptions=a)
    if include_sensitivity:
        w=[a['wacc']+d for d in [-.02,-.01,0,.01,.02]];g=[a['terminalGrowth']+d for d in [-.02,-.01,0,.01,.02]]
        def cell(wacc,growth):
            try:return calculate(company,{**a,'wacc':wacc,'terminalGrowth':growth},share_observations,False)['perShare']
            except ValueError:return None
        result['sensitivity']=dict(wacc=w,growth=g,values=[[cell(wacc,growth) for growth in g] for wacc in w])
    return result
