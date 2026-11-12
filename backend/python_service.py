"""Authoritative Python calculation adapter, called via stdin by the Node HTTP layer."""
from __future__ import annotations
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from portable_finance import calculate as portable_calculate
from fundamental_analytics import fundamental_ratios, capital_cost, relative_metrics, implied_peer_values, divide, finite
from research_store import ResearchStore

def py_assumptions(a):
    required=['wacc','terminalGrowth','tax','growth','margin','daRatio','capexRatio','nwcRatio','excessCash','debt','leases','nci','valuationDate','informationCutoff','studyMode']
    missing=[k for k in required if k not in a]
    if missing:raise ValueError('Missing assumptions: '+', '.join(missing))
    if not isinstance(a['growth'],list) or len(a['growth'])!=5 or not all(finite(v) for v in a['growth']):raise ValueError('The application requires five finite annual growth assumptions.')
    for key in ['wacc','terminalGrowth','tax','margin','daRatio','capexRatio','nwcRatio','excessCash','debt','leases','nci']:
        if not finite(a[key]):raise ValueError(key+' must be a finite numeric value.')
    return dict(wacc=a['wacc'],terminal_growth=a['terminalGrowth'],operating_tax_rate=a['tax'],forecast_growth=a['growth'],forecast_ebit_margin=[a['margin']]*len(a['growth']),forecast_da_ratio=[a['daRatio']]*len(a['growth']),forecast_capex_ratio=[a['capexRatio']]*len(a['growth']),forecast_nwc_ratio=[a['nwcRatio']]*len(a['growth']),excess_cash=a['excessCash'],debt=a['debt'],lease_liabilities=a['leases'],non_controlling_interest=a['nci'],valuation_date=a['valuationDate'],information_cutoff=a['informationCutoff'],study_mode=a['studyMode'])

def valid_market(m):
    import re
    from urllib.parse import urlparse
    from datetime import date
    if not isinstance(m,dict):return False
    url=urlparse(str(m.get('sourceUrl','')));host=url.hostname or ''
    try:day=date.fromisoformat(m.get('date',''))
    except (ValueError,TypeError):return False
    filename=str(m.get('sourceArtifact',''));tokens=[day.strftime('%Y%m%d'),day.strftime('%d%m%y'),day.strftime('%d%m%Y')]
    return m.get('method')=='direct_bse_close' and m.get('reviewed') is True and finite(m.get('price')) and m['price']>0 and url.scheme=='https' and (host=='bseindia.com' or host.endswith('.bseindia.com')) and bool(re.fullmatch('[a-fA-F0-9]{64}',str(m.get('sourceFileSha256','')))) and any(t in filename for t in tokens)

def valid_share_evidence(observation,company_id):
    from urllib.parse import urlparse
    source=urlparse(str(observation.get('shareSourceUrl','')))
    expected={'infosys':'infosys.com','tcs':'tcs.com','hcltech':'hcltech.com','wipro':'wipro.com'}.get(company_id)
    host=source.hostname or ''
    return bool(expected and source.scheme=='https' and (host==expected or host.endswith('.'+expected)) and finite(observation.get('netSharesCrore')) and observation['netSharesCrore']>0)

def valuation(company,a,market_overrides=None):
    snapshot=json.loads((ROOT/'data/source_snapshot.json').read_text())
    bundle=json.loads((ROOT/'data/companies.json').read_text())
    model=portable_calculate(company,a,snapshot['share_observations'])
    overrides=market_overrides if isinstance(market_overrides,dict) else {}
    own=overrides.get(company['id'],{});market=own.get('market')
    compatible=valid_market(market) and valid_share_evidence(own,company['id']) and market['date']==a['valuationDate']==company['shares']['date'] and own.get('netSharesCrore')==company['shares']['netCrore'] and own.get('shareDate')==a['valuationDate']
    if compatible:
        model['market']=market;model['upside']=model['perShare']/market['price']-1
        model['warnings']=[w for w in model['warnings'] if not w.startswith('No same-date direct BSE')]
    latest=snapshot['annuals'][-1]
    subject=dict(id=company['id'],name=company['name'],revenue=latest['revenue'],ebit=latest['operating_ebit']-latest.get('labour_code_exceptional_item',0),netIncome=latest['net_income_attributable_owners'],year=latest['fiscal_year'])
    peer_comparison=[];raw_peers=[]
    for p in [subject,*bundle['peers']]:
        imported=overrides.get(p['id'],{});m=imported.get('market');price_ok=valid_market(m) and valid_share_evidence(imported,p['id']) and m['date']==a['valuationDate']==imported.get('shareDate')
        if p['id']==company['id']:price_ok=compatible
        raw=dict(id=p['id'],price=m['price'] if price_ok else None,price_date=m.get('date') if price_ok else None,share_date=imported.get('shareDate'),net_shares_crore=imported.get('netSharesCrore'),revenue=p['revenue'],ebit=p['ebit'],net_income=p['netIncome'],book_equity=latest.get('equity_attributable_owners') if p['id']==company['id'] else None,ebitda=p['ebit']+latest['depreciation_amortization'] if p['id']==company['id'] else None,**{k:imported.get(k) for k in ['debt','cash','leases','nci']})
        financial_keys=['debt','cash','leases','nci','bookEquity','ebitda']
        if any(imported.get(k) is not None for k in financial_keys):
            from urllib.parse import urlparse
            source=urlparse(str(imported.get('financialSourceUrl','')));expected={'infosys':'infosys.com','tcs':'tcs.com','hcltech':'hcltech.com','wipro':'wipro.com'}[p['id']];host=source.hostname or ''
            if source.scheme!='https' or not (host==expected or host.endswith('.'+expected)):raise ValueError('Optional peer financial inputs require a reviewed official-company financial source URL.')
            if any(not finite(imported[k]) or imported[k]<0 for k in financial_keys if imported.get(k) is not None):raise ValueError('Peer financial inputs must be non-negative finite amounts or unavailable.')
        if p['id']!=company['id']:
            raw['book_equity']=imported.get('bookEquity');raw['ebitda']=imported.get('ebitda')
        multiples=relative_metrics(raw)
        if p['id']!=company['id']:raw_peers.append(raw)
        peer_comparison.append({**p,'ebitMargin':divide(p['ebit'],p['revenue']),'netMargin':divide(p['netIncome'],p['revenue']),'pe':multiples['pe'],'pb':multiples['pb'],'ps':multiples['ps'],'evEbitda':multiples['ev_ebitda'],'evEbit':multiples['ev_ebit'],'evRevenue':multiples['ev_revenue'],'enterpriseValue':multiples['enterprise_value'],'marketCap':multiples['market_cap']})
    model['analytics']=fundamental_ratios(snapshot['annuals'],a['tax'])
    model['peerComparison']=peer_comparison
    target=dict(net_income=latest['net_income_attributable_owners'],book_equity=latest.get('equity_attributable_owners'),revenue=latest['revenue'],ebit=subject['ebit'],ebitda=subject['ebit']+latest['depreciation_amortization'],net_shares_crore=model['shares'],debt=a['debt'],cash=a['excessCash'],leases=a['leases'],nci=a['nci'])
    model['peerImpliedValues']=implied_peer_values(raw_peers,target)
    return model

def explain(question,company,a,result):
    import re
    q=question.lower();snapshot=json.loads((ROOT/'data/source_snapshot.json').read_text());metrics=fundamental_ratios(snapshot['annuals'],a['tax']);last=snapshot['annuals'][-1];first=snapshot['annuals'][0]
    percent=lambda x:f'{x*100:.1f}%'
    amount=lambda x:f'{x:,.1f}'
    title='Research coverage'
    if re.search(r'revenue|sales|growth|performance|profit|margin',q) and not re.search(r'wacc|discount|terminal|cost of capital',q):
        title='Revenue and operating performance';body=f"Revenue increased from INR {amount(first['revenue'])} crore in FY{first['fiscal_year']} to INR {amount(last['revenue'])} crore in FY{last['fiscal_year']}, a {percent(metrics['revenue_cagr'])} annualised increase. Latest pre-exception operating margin is {percent(metrics['annuals'][-1]['operating_margin'])}. Forecast growth rates {', '.join(percent(x) for x in a['growth'])} are analyst assumptions, not reported results."
    elif re.search(r'wacc|discount|terminal|cost of capital',q):
        title='Discount rate and terminal value';body=f"This scenario uses {percent(a['wacc'])} WACC and {percent(a['terminalGrowth'])} perpetual growth. These are educational assumptions. With positive cash flows, a higher discount rate reduces present value. Python rebuilds terminal-year reinvestment for every sensitivity cell. Terminal value contributes {percent(result['terminalContribution']) if result['terminalContribution'] is not None else 'an unavailable proportion'} of operating value. A researched WACC needs sourced risk-free rate, beta, risk premium, cost of debt and market capital weights."
    elif re.search(r'cash|debt|bridge|share|treasury|dilut',q):
        title='Equity bridge and share denominator';body=f"The scenario adds INR {amount(a['excessCash'])} crore excess cash and subtracts INR {amount(a['debt'])} crore debt, INR {amount(a['leases'])} crore leases and INR {amount(a['nci'])} crore minority interests. The net-share denominator is {company['shares']['netCrore']:.7f} crore dated {company['shares']['date']}. Treasury is already excluded and is not subtracted again. Period-end award dilution remains unresolved."
    elif re.search(r'peer|compar|multiple',q):
        title='Comparable valuation coverage';body='The peer snapshot uses reported-basis TCS, HCLTech and Wipro FY26 financials. P/E, P/B, P/S and enterprise-value multiples require compatible market prices and denominators. Missing evidence remains unavailable. Different business mix, growth, risk and capital intensity can justify different multiples.'
    elif re.search(r'risk|limitation|buy|sell|invest|trust',q):
        title='Model limitations';body='This is an educational scenario, not a recommendation. '+' '.join(result.get('warnings',[]))
    elif re.search(r'value|valuation|fcff|dcf|explain',q):
        title='How this scenario is valued';body=f"Python calculates FCFF as EBIT times (1 minus operating tax), plus depreciation, minus capex and the increase in working capital. Discounted forecast cash contributes INR {amount(result['forecastPV'])} crore; terminal cash contributes INR {amount(result['terminalPV'])} crore. After the bridge, the provisional scenario value is INR {amount(result['perShare'])} per share. Assumptions and retrospective limitations remain attached."
    elif re.search(r'source|report|data|audit',q):
        title='Evidence and lineage';body='The reviewed Infosys snapshot covers three annual consolidated periods in INR crore. Source records retain official URLs, pages, publication dates and unit conversions. Twelve accounting checks pass. Fingerprints identify input files, not financial correctness. The local Python application can persist valuation snapshots in SQLite.'
    else:body='I can explain the loaded revenue history, valuation, WACC, terminal value, shares, bridge, peer coverage and limitations. This evidence mode does not browse or invent answers to unsupported questions.'
    sources=company['sources']
    if 'peer' in title.lower():sources=[s for s in sources if s['kind']=='Peer financials']
    else:sources=[s for s in sources if s['kind']=='Financial statements']
    return dict(title=title,body=body,citations=sources,mode='evidence',calculationAuthority='python')

def dispatch(input):
    action=input.get('action','valuation')
    if action=='capital_cost':return capital_cost(input['inputs'])
    if action=='runs':return {'runs':ResearchStore(ROOT/'data/runtime/research.sqlite3').list_runs(input.get('companyId'))}
    bundle=json.loads((ROOT/'data/companies.json').read_text());company=next((c for c in bundle['companies'] if c['id']==input.get('companyId')),None)
    if not company:raise ValueError('Unknown registered company.')
    a=input.get('assumptions') or company['assumptions']
    if not isinstance(a,dict):raise ValueError('Assumptions must be a JSON object.')
    if action=='analytics':
        snapshot=json.loads((ROOT/'data/source_snapshot.json').read_text());return fundamental_ratios(snapshot['annuals'],a['tax'])
    if action=='assistant':
        result=input.get('result') or valuation(company,a)
        if not result.get('valid'):return dict(title='Valuation needs attention',body='Correct the model inputs before interpreting the valuation.',citations=company['sources'],mode='evidence',calculationAuthority='python')
        return explain(str(input.get('question',''))[:2000],company,a,result)
    if action!='valuation':raise ValueError('Unknown Python operation.')
    result=valuation(company,a,input.get('marketOverrides'))
    result['inputManifest']=company.get('inputManifest')
    if input.get('marketOverrides'):result['marketEvidence']=input['marketOverrides']
    if input.get('persist'):result['runId']=ResearchStore(ROOT/'data/runtime/research.sqlite3').save(company['id'],a,result)
    return result

def main():
    try:
        payload=json.load(sys.stdin)
        if not isinstance(payload,dict):raise ValueError('Request must be a JSON object.')
        output=dispatch(payload)
    except KeyError as e:output={'valid':False,'errors':[f'Missing required field: {e.args[0]}'],'reconciliations':[],'calculationAuthority':'python'}
    except (ValueError,TypeError) as e:output={'valid':False,'errors':[str(e)],'reconciliations':[],'calculationAuthority':'python'}
    except Exception as e:  # never leak a traceback to API clients; log it for operators
        print(f'python_service internal error: {type(e).__name__}: {e}',file=sys.stderr)
        output={'valid':False,'errors':['The calculation could not be completed with these inputs.'],'reconciliations':[],'calculationAuthority':'python'}
    print(json.dumps(output,allow_nan=False))

if __name__=='__main__':
    main()
