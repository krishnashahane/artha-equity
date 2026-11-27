import json,sys,unittest,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from portable_finance import calculate
from equity_platform import build_historical,run_fcff_valuation
import pandas as pd

class PortableFinanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.company=json.loads((ROOT/'data/companies.json').read_text())['companies'][0]
        cls.shares=json.loads((ROOT/'data/source_snapshot.json').read_text())['share_observations']
        cls.historical=build_historical(pd.read_csv(ROOT/'data/raw/infosys_source_records.csv'))
        cls.share_frame=pd.read_csv(ROOT/'data/shares/infosys_share_observations.csv')
    def test_three_scenarios_match_the_independent_notebook_engine(self):
        for kind in ['base','bull','bear']:
            a=copy.deepcopy(self.company['assumptions'])
            if kind=='bull':a['growth']=[x+.02 for x in a['growth']];a['margin']+=.015;a['wacc']-=.01
            if kind=='bear':a['growth']=[x-.03 for x in a['growth']];a['margin']-=.02;a['wacc']+=.015
            py=dict(wacc=a['wacc'],terminal_growth=a['terminalGrowth'],operating_tax_rate=a['tax'],forecast_growth=a['growth'],forecast_ebit_margin=[a['margin']]*5,forecast_da_ratio=[a['daRatio']]*5,forecast_capex_ratio=[a['capexRatio']]*5,forecast_nwc_ratio=[a['nwcRatio']]*5,excess_cash=a['excessCash'],debt=a['debt'],lease_liabilities=a['leases'],non_controlling_interest=a['nci'],valuation_date=a['valuationDate'],information_cutoff=a['informationCutoff'],study_mode=a['studyMode'])
            _,benchmark=run_fcff_valuation(self.historical,py,self.share_frame,'infosys');r=calculate(self.company,a,self.shares)
            self.assertAlmostEqual(r['enterpriseValue'],benchmark['enterprise_value_inr_crore'],places=6)
            self.assertAlmostEqual(r['perShare'],benchmark['value_per_share_inr'],places=8)
    def test_broken_statements_block_deployment_model(self):
        c=copy.deepcopy(self.company);c['historical'][-1]['assets']+=10
        with self.assertRaises(ValueError):calculate(c,c['assumptions'],self.shares)
    def test_banks_are_not_forced_through_fcff(self):
        c=copy.deepcopy(self.company);c['sector']='Banking'
        with self.assertRaises(ValueError):calculate(c,c['assumptions'],self.shares)
    def test_publication_cutoff_and_date_errors_block(self):
        for patch in [{'informationCutoff':'2026-03-31'},{'valuationDate':'2026-02-31'}]:
            with self.assertRaises(ValueError):calculate(self.company,{**self.company['assumptions'],**patch},self.shares)
    def test_preview_cases_remain_json_serializable(self):
        json.dumps(calculate(self.company,self.company['assumptions'],self.shares),allow_nan=False)
