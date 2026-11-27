import copy
import json
from pathlib import Path
import sys
import unittest
import pandas as pd
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / 'src'));sys.path.insert(0,str(ROOT))
from portable_finance import calculate
from valuation_studies import monte_carlo, reverse_dcf
from backend.python_service import py_assumptions, safe_dispatch
from equity_platform import build_historical, run_fcff_valuation

class ValuationStudiesTests(unittest.TestCase):
    def setUp(self):
        self.company=json.loads((ROOT/'data/companies.json').read_text())['companies'][0]
        self.a=copy.deepcopy(self.company['assumptions'])
        self.shares=json.loads((ROOT/'data/source_snapshot.json').read_text())['share_observations']

    def test_yearly_margin_parity_with_pandas_within_1e8(self):
        self.a['margins']=[.19,.20,.21,.22,.23]
        result=calculate(self.company,self.a,self.shares)
        historical=build_historical(pd.read_csv(ROOT/'data/raw/infosys_source_records.csv'))
        forecast, benchmark=run_fcff_valuation(historical,py_assumptions(self.a),pd.read_csv(ROOT/'data/shares/infosys_share_observations.csv'),'infosys')
        self.assertLess(abs(result['perShare']-benchmark['value_per_share_inr']),1e-8)
        self.assertLess(abs(result['enterpriseValue']-benchmark['enterprise_value_inr_crore']),1e-8)
        self.assertAlmostEqual(result['terminalRevenue']*.23*(1-self.a['tax'])-(result['terminalRevenue']*(self.a['capexRatio']-self.a['daRatio'])+result['terminalRevenue']*self.a['nwcRatio']-result['forecast'][-1]['nwc']),result['terminalFcff'])

    def test_seed_repeatability_percentile_order_and_histogram(self):
        a=monte_carlo(self.company,self.a,self.shares,{'iterations':100})
        b=monte_carlo(self.company,self.a,self.shares,{'iterations':100})
        self.assertEqual(a,b);self.assertLess(a['p5'],a['p50']);self.assertLess(a['p50'],a['p95'])
        self.assertEqual(sum(x['count'] for x in a['histogram']),100)
        zero=monte_carlo(self.company,self.a,self.shares,dict(iterations=100,growthSpread=0,marginSpread=0,waccSpread=0))
        self.assertEqual(zero['p5'],calculate(self.company,self.a,self.shares)['perShare'])
        self.assertEqual(zero['p5'],zero['p95'])

    def test_reverse_recovers_known_growth(self):
        for growth in [-.1,0,.08,.3]:
            value=calculate(self.company,{**self.a,'growth':[growth]*5},self.shares)['perShare']
            solved=reverse_dcf(self.company,self.a,self.shares,value)
            self.assertLess(abs(solved['impliedGrowth']-growth),1e-10)
            self.assertLess(abs(solved['residual']),1e-6)
        for price in [0,-1,float('nan'),True,1e50]:
            with self.assertRaises(ValueError):reverse_dcf(self.company,self.a,self.shares,price)

    def test_invalid_sampling_and_margin_inputs(self):
        for options in [{'iterations':10000},{'iterations':True},{'growthSpread':-1},{'marginSpread':float('inf')},{'waccSpread':.2}]:
            with self.assertRaises(ValueError):monte_carlo(self.company,self.a,self.shares,options)
        for margins in [[.2], [True]*5, [float('nan')]*5, [2]*5]:
            with self.assertRaises(ValueError):calculate(self.company,{**self.a,'margins':margins},self.shares)

    def test_bridge_values_and_safe_errors(self):
        result=calculate(self.company,self.a,self.shares)
        self.assertEqual(result['bridge'][-1]['end'],result['equityValue'])
        self.assertEqual(result['bridge'][-2]['end'],result['equityValue'])
        self.assertFalse(safe_dispatch({'action':'valuation','companyId':'infosys','assumptions':None})['valid'])
