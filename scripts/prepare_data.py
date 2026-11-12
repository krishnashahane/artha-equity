"""Build reviewed CSV records and the web dataset from the committed source snapshot.

This is a deterministic transformation, not a scraper. The snapshot retains official
URLs, publication dates, definitions and page references for human re-review.
"""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
snapshot_path = ROOT / 'data/source_snapshot.json'
research = json.loads(snapshot_path.read_text())
source_columns = 'company,fiscal_year,field,raw_value,raw_unit,conversion_factor,normalized_value_inr_crore,period_end,publication_date,frequency,basis,source_url,report_title,printed_page,pdf_page,retrieval_date,verification_status,notes'.split(',')
rows=[]
for annual in research['annuals']:
    source = research['sources'][annual['source_id']]
    for field, page_key in research['field_source_page_key'].items():
        if annual.get(field) is None:
            continue
        page=source['pages'][page_key]
        shares=field.endswith('_shares')
        factor=1e-7 if shares else 1
        notes='Reviewed source snapshot; consolidated INR crore. See data/source_snapshot.json for exact definitions.'
        if field=='operating_ebit': notes='Operating EBIT before exceptional items; PBT before exceptional items + finance cost − other income.'
        if field=='capex': notes='Cash expenditure on PPE/intangibles, positive for FCFF subtraction; acquisitions excluded.'
        rows.append(dict(company='Infosys Limited',fiscal_year=annual['fiscal_year'],field=field,raw_value=annual[field],raw_unit='shares' if shares else 'INR crore',conversion_factor=factor,normalized_value_inr_crore=annual[field]*factor,period_end=annual['period_end'],publication_date=source['publication_date'],frequency='annual',basis='consolidated',source_url=source['url'],report_title=source['title'],printed_page=page['printed'],pdf_page=page['pdf'],retrieval_date=research['retrieved_at'],verification_status='verified',notes=notes))
    if annual['fiscal_year']==2026:
        for field in ['period_end_paid_up_shares','treasury_shares']:
            page=source['pages']['gross_share_basis' if field=='period_end_paid_up_shares' else 'equity_shares_net_and_treasury']
            raw=annual[field]
            rows.append(dict(company='Infosys Limited',fiscal_year=2026,field=field,raw_value=raw,raw_unit='shares',conversion_factor=1e-7,normalized_value_inr_crore=raw/1e7,period_end=annual['period_end'],publication_date=source['publication_date'],frequency='annual',basis='consolidated',source_url=source['url'],report_title=source['title'],printed_page=page['printed'],pdf_page=page['pdf'],retrieval_date=research['retrieved_at'],verification_status='verified',notes='Gross paid-up shares less treasury equals the independently reported net outstanding count. Never subtract treasury from an already net count.'))
with (ROOT/'data/raw/infosys_source_records.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=source_columns);w.writeheader();w.writerows(rows)
share_columns='company_id,effective_date,publication_date,net_outstanding_shares,net_outstanding_crore,treasury_shares,treasury_shares_crore,diluted_weighted_average_shares,fully_diluted_period_end_shares,fully_diluted_period_end_crore,fully_diluted_period_end_status,denominator_method,source_url,dilution_source_url,report_title,pdf_page,retrieval_date,verification_status,notes'.split(',')
share_rows=[]
for s in research['share_observations']:
    source=research['sources'][s['source_id']]
    share_rows.append(dict(company_id='infosys',effective_date=s['effective_date'],publication_date=s['publication_date'],net_outstanding_shares=s['net_outstanding_shares'],net_outstanding_crore=s['net_outstanding_shares']/1e7,treasury_shares=s['treasury_shares'],treasury_shares_crore=s['treasury_shares']/1e7,diluted_weighted_average_shares=s.get('diluted_weighted_average_shares',4120108168),fully_diluted_period_end_shares='',fully_diluted_period_end_crore='',fully_diluted_period_end_status='unavailable',denominator_method='Reported period-end net outstanding shares; treasury already excluded',source_url=source['url'],dilution_source_url='',report_title=source['title'],pdf_page=s['net_source_pdf_page'],retrieval_date='2026-10-26',verification_status='verified',notes='Net count verified directly; employee-award period-end dilution not established.'))
with (ROOT/'data/shares/infosys_share_observations.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=share_columns);w.writeheader();w.writerows(share_rows)
market_columns='company_id,bse_scrip,observation_date,observation_time_ist,close_price_inr,currency,market_cap_inr_crore,price_method,source_url,source_artifact,source_file_sha256,retrieval_date,verification_status,notes'.split(',')
market_path=ROOT/'data/market/infosys_market_observations.csv'
if not market_path.exists():
    with market_path.open('w',newline='') as f: csv.writer(f).writerow(market_columns)
peer_columns='company_id,peer_company,peer_bse_scrip,metric,metric_value,currency,financial_period_end,market_observation_date,publication_date,definition,source_url,verification_status,notes,price_method'.split(',')
with (ROOT/'data/peers/peer_inputs.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=peer_columns);w.writeheader()
    for p in research['peers']:
        for field,metric in [('revenue','revenue_inr_crore'),('reported_operating_ebit','ebit_inr_crore'),('reported_net_income_attributable_owners','net_income_inr_crore')]:
            w.writerow(dict(company_id='infosys',peer_company=p['company'],peer_bse_scrip=p['bse_scrip'],metric=metric,metric_value=p[field],currency='INR',financial_period_end='2026-03-31',market_observation_date='',publication_date=p['results_publication_date'],definition='Consolidated reported basis; EBIT excludes finance cost and other income; NI attributable to owners.',source_url=p['source_url'],verification_status='verified',notes=p['notes'],price_method=''))
with (ROOT/'data/company_universe.csv').open('w',newline='') as f:
    w=csv.writer(f);w.writerow(['company_id','company','bse_scrip','isin','sector','coverage_status','notes'])
    w.writerow(['infosys','Infosys Limited','500209','INE009A01021','Information Technology','valuation_ready','Three reconciled annual periods; provisional dilution and educational assumptions.'])
    for p in research['peers']: w.writerow([p['company_id'],p['company'],p['bse_scrip'],'','Information Technology','peer_fundamentals_ready','Full three-year statement history and shares required for standalone DCF.'])

mapping={'fiscal_year':'year','revenue':'revenue','operating_ebit':'ebit','net_income_attributable_owners':'netIncome','depreciation_amortization':'da','capex':'capex','trade_receivables':'receivables','trade_payables':'payables','cash_and_cash_equivalents':'cash','total_assets':'assets','total_equity':'equity','total_liabilities':'liabilities','cash_flow_operating':'cfo','cash_flow_investing':'cfi','cash_flow_financing':'cff','cash_flow_net_change':'netCashChange','cash_fx_effect':'fx','cash_opening':'openingCash','cash_flow_closing_cash_equivalents':'closingCash'}
historical=[{**{dest:a[field] for field,dest in mapping.items()},'sourceIds':[a['source_id']],'reportedEbit':a['operating_ebit']-a.get('labour_code_exceptional_item',0)} for a in research['annuals']]
sources=[]
for sid in ['fy25_statements','fy26_statements']:
    s=research['sources'][sid]
    sources.append(dict(id=sid,title=s['title'],url=s['url'],publicationDate=s['publication_date'],retrievedAt=research['retrieved_at'],pages='PDF 2–7; equity note '+('27–28' if sid=='fy26_statements' else '29–30'),basis='Consolidated Ind AS',unit='INR crore',kind='Financial statements',verified=True))
for p in research['peers']:
    sources.append(dict(id=p['company_id']+'_fy26',title=p['company']+' — FY2026 results',url=p['source_url'],publicationDate=p['results_publication_date'],retrievedAt=research['retrieved_at'],pages='PDF '+str(p['source_pdf_page']),basis=p['basis'],unit='INR crore',kind='Peer financials',verified=True))
a=research['annuals'][-1]
assumptions=dict(wacc=.12,terminalGrowth=.05,growth=[.09,.08,.07,.06,.05],margin=.205,tax=.25,daRatio=.027,capexRatio=.016,nwcRatio=.17,excessCash=0,debt=0,leases=a['lease_liabilities'],nci=a['non_controlling_interest'],valuationDate='2026-03-31',informationCutoff='2026-10-26',studyMode='retrospective')
facts=[dict(id=f"infosys_{r['fiscal_year']}_{r['field']}",year=r['fiscal_year'],field=r['field'],value=r['normalized_value_inr_crore'],unit='crore shares' if r['raw_unit']=='shares' else 'INR crore',sourceId='fy26_statements' if r['fiscal_year']==2026 else 'fy25_statements',sourceUrl=r['source_url'],pdfPage=r['pdf_page'],printedPage=r['printed_page'],publicationDate=r['publication_date'],notes=r['notes']) for r in rows]
company=dict(id='infosys',name='Infosys Limited',ticker='INFY',scrip='500209',isin='INE009A01021',sector='Information technology',currency='INR',unit='INR crore',historical=historical,facts=facts,sources=sources,shares=dict(date='2026-03-31',netCrore=a['net_outstanding_shares']/1e7,grossCrore=a['period_end_paid_up_shares']/1e7,treasuryCrore=a['treasury_shares']/1e7,fullyDilutedCrore=None,sourceId='fy26_statements'),market=None,bridgeReviewed=False,assumptions=assumptions,fieldDefinitions={'ebit':'Pre-exception operating profit for Infosys forecasts; the peer comparison uses reported EBIT consistently.','operatingNwc':'Trade receivables minus trade payables; simplified educational definition.','capex':'Cash PPE/intangible expenditure, excluding acquisitions.','excessCash':'Explicit analyst assumption; restricted cash and operating reserve must be assessed.'},inputManifest={'sha256':hashlib.sha256(snapshot_path.read_bytes()).hexdigest(),'source':'data/source_snapshot.json','asOf':'2026-10-26'})
peers=[dict(id=p['company_id'],name={'tcs':'Tata Consultancy Services','hcltech':'HCLTech','wipro':'Wipro'}[p['company_id']],scrip=p['bse_scrip'],revenue=p['revenue'],ebit=p['reported_operating_ebit'],netIncome=p['reported_net_income_attributable_owners'],dilutedEps=p['reported_diluted_eps'],year=2026,market=None,netSharesCrore=None,shareDate=None,debt=None,cash=None,leases=None,nci=None,sourceId=p['company_id']+'_fy26',notes=p['notes'],unit='INR crore') for p in research['peers']]
bundle={'schemaVersion':'1.0','asOf':'2026-10-26','companies':[company],'peers':peers}
(ROOT/'data/companies.json').write_text(json.dumps(bundle,indent=2)+'\n')
print(f'Prepared {len(rows)} reviewed source records, {len(share_rows)} share observations and {len(peers)} peer snapshots.')
