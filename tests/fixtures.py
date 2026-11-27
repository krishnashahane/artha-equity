"""Synthetic market observations used only in tests, never production inputs."""
import pandas as pd

def synthetic_market():
    return pd.DataFrame([dict(company_id='infosys',bse_scrip='500209',observation_date='2026-06-30',observation_time_ist='context',close_price_inr=1000.0,currency='INR',market_cap_inr_crore=pd.NA,price_method='synthetic_test_context',source_url='https://example.com/test-fixture',source_artifact='synthetic-only',source_file_sha256='',retrieval_date='2026-07-01',verification_status='verified',notes='Synthetic test fixture; not a real market observation.')])
