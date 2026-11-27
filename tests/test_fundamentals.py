import json
from pathlib import Path
import sys,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from fundamental_analytics import capital_cost,fundamental_ratios,relative_metrics,implied_peer_values
from research_store import ResearchStore

class FundamentalTests(unittest.TestCase):
    def test_capm_wacc_hand_calculated_example(self):
        r=capital_cost(dict(risk_free_rate=.05,beta=1.2,equity_risk_premium=.06,cost_of_debt=.08,tax_rate=.25,market_equity_value=800,market_debt_value=200))
        self.assertAlmostEqual(r['cost_of_equity'],.122);self.assertAlmostEqual(r['wacc'],.1096)
    def test_wacc_uses_market_weights_and_rejects_missing_inputs(self):
        with self.assertRaises(ValueError):capital_cost({'beta':1})
    def test_average_denominators_and_missing_gross_margin(self):
        a=json.loads((ROOT/'data/source_snapshot.json').read_text())['annuals'];r=fundamental_ratios(a)
        self.assertIsNone(r['annuals'][0]['roa']);self.assertIsNone(r['annuals'][-1]['gross_margin'])
        self.assertAlmostEqual(r['annuals'][-1]['roa'],29474/((148903+155967)/2))
    def test_missing_working_capital_change_does_not_become_zero(self):
        a=json.loads((ROOT/'data/source_snapshot.json').read_text())['annuals'];self.assertIsNone(fundamental_ratios(a)['annuals'][0]['fcff_assumed_tax'])
    def test_relative_valuation_and_implied_price(self):
        p=dict(id='synthetic',price=100,net_shares_crore=10,price_date='2026-03-31',share_date='2026-03-31',net_income=50,book_equity=500,revenue=1000,ebitda=150,ebit=100,debt=100,leases=20,nci=0,cash=50)
        r=relative_metrics(p);self.assertEqual(r['pe'],20);self.assertEqual(r['pb'],2);self.assertAlmostEqual(r['ev_ebitda'],1070/150)
        t={**p,'net_income':60};self.assertEqual(implied_peer_values([p],t)['pe']['implied_value_per_share'],120)
    def test_missing_peer_prices_do_not_become_zero_multiples(self):
        r=relative_metrics(dict(id='missing',price=None,net_shares_crore=None));self.assertIsNone(r['pe']);self.assertIsNone(r['ev_ebitda'])
    def test_sqlite_run_round_trip_and_parameterization(self):
        with tempfile.TemporaryDirectory() as d:
            store=ResearchStore(Path(d)/'test.sqlite3');rid=store.save('infosys',{'wacc':.12},{'equityValue':1})
            self.assertEqual(store.list_runs('infosys')[0]['id'],rid);self.assertEqual(store.list_runs("x' OR 1=1 --"),[])

if __name__=='__main__':unittest.main()
