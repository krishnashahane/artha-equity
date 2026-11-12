"""Compile preview cases and explanations using the authoritative Python service."""
import copy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from backend.python_service import valuation,explain
bundle=json.loads((ROOT/'data/companies.json').read_text());cases={};answers={}
topics={'growth':'Explain revenue growth','valuation':'Explain the FCFF valuation','discount':'Explain WACC and terminal value','bridge':'Explain shares and the cash debt bridge','peers':'Explain peer comparison','risks':'What are the model limitations?','sources':'Explain data sources and audit'}
for company in bundle['companies']:
    cases[company['id']]={};answers[company['id']]={}
    for scenario in ['base','bull','bear']:
        a=copy.deepcopy(company['assumptions'])
        if scenario=='bull':a['growth']=[x+.02 for x in a['growth']];a['margin']+=.015;a['wacc']=max(.05,a['wacc']-.01)
        if scenario=='bear':a['growth']=[max(-.8,x-.03) for x in a['growth']];a['margin']-=.02;a['wacc']+=.015
        r=valuation(company,a);r['inputManifest']=company['inputManifest'];cases[company['id']][scenario]=r
        answers[company['id']][scenario]={key:explain(q,company,a,r) for key,q in topics.items()}
print(json.dumps({'cases':cases,'answers':answers},allow_nan=False))
