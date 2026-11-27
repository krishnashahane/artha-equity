"""JSON-in/JSON-out bridge for independent Python versus browser model checks."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
import pandas as pd
from equity_platform import build_historical, run_fcff_valuation
a=json.load(sys.stdin)
py={'wacc':a['wacc'],'terminal_growth':a['terminalGrowth'],'operating_tax_rate':a['tax'],'forecast_growth':a['growth'],'forecast_ebit_margin':[a['margin']]*5,'forecast_da_ratio':[a['daRatio']]*5,'forecast_capex_ratio':[a['capexRatio']]*5,'forecast_nwc_ratio':[a['nwcRatio']]*5,'excess_cash':a['excessCash'],'debt':a['debt'],'lease_liabilities':a['leases'],'non_controlling_interest':a['nci'],'valuation_date':a['valuationDate'],'information_cutoff':a['informationCutoff'],'study_mode':a['studyMode']}
records=pd.read_csv(ROOT/'data/raw/infosys_source_records.csv')
shares=pd.read_csv(ROOT/'data/shares/infosys_share_observations.csv')
forecast,summary=run_fcff_valuation(build_historical(records),py,shares,'infosys')
print(json.dumps({'summary':summary,'fcff':forecast.fcff.tolist(),'pv':forecast.pv_fcff.tolist()},allow_nan=False))
