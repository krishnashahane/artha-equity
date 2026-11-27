"""Create a non-active company data workspace without falsely enabling valuation."""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
from pathlib import Path


SOURCE_HEADER = "company,fiscal_year,field,raw_value,raw_unit,conversion_factor,normalized_value_inr_crore,period_end,publication_date,frequency,basis,source_url,report_title,printed_page,pdf_page,retrieval_date,verification_status,notes\n"
SHARE_HEADER = "company_id,effective_date,publication_date,net_outstanding_shares,net_outstanding_crore,treasury_shares,treasury_shares_crore,diluted_weighted_average_shares,fully_diluted_period_end_shares,fully_diluted_period_end_crore,fully_diluted_period_end_status,denominator_method,source_url,dilution_source_url,report_title,pdf_page,retrieval_date,verification_status,notes\n"

parser = argparse.ArgumentParser(description="Scaffold a BSE company workspace for reviewed source data.")
parser.add_argument("--company-id", required=True, help="lowercase snake_case identifier")
parser.add_argument("--company", required=True)
parser.add_argument("--bse-scrip", required=True)
parser.add_argument("--isin", required=True)
parser.add_argument("--sector", required=True)
parser.add_argument("--official-domain", required=True)
parser.add_argument("--ticker", required=True)
args = parser.parse_args()

if not re.fullmatch(r'[a-z0-9-]+(?:\.[a-z0-9-]+)+', args.official_domain):
    raise SystemExit('official-domain must be a reviewed issuer hostname.')
if not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", args.company_id):
    raise SystemExit("company-id must use lowercase snake_case.")
if not re.fullmatch(r"\d{6}", args.bse_scrip):
    raise SystemExit("bse-scrip must contain exactly six digits.")
if not re.fullmatch(r"[A-Z0-9]{12}", args.isin.upper()):
    raise SystemExit("isin must contain exactly 12 uppercase alphanumeric characters.")

root = Path(__file__).resolve().parents[1]
universe = root / "data/company_universe.csv"
raw = root / "data/raw" / f"{args.company_id}_source_records.csv"
shares = root / "data/shares" / f"{args.company_id}_share_observations.csv"
assumptions = root / "config/assumptions" / f"{args.company_id}.json"
template = root / "config/assumptions_template.json"
if not template.exists():
    raise SystemExit("Assumption template is missing; no workspace was created.")
existing_universe = []
if universe.exists():
    with universe.open(newline="") as handle:
        existing_universe = list(csv.DictReader(handle))
existing_entry = next((row for row in existing_universe if row['company_id'] == args.company_id), None)
if existing_entry and existing_entry['coverage_status'] != 'peer_fundamentals_ready':
    raise SystemExit('Company already has a workspace or active valuation coverage; no file changed.')
workspace = root / 'data/workspaces' / args.company_id
if workspace.exists():
    raise SystemExit('Company web workspace already exists; no file changed.')
for path in (raw, shares, assumptions):
    if path.exists():
        raise SystemExit(f"Workspace target already exists ({path}); no file changed.")

raw.parent.mkdir(parents=True, exist_ok=True)
shares.parent.mkdir(parents=True, exist_ok=True)
assumptions.parent.mkdir(parents=True, exist_ok=True)
raw.write_text(SOURCE_HEADER)
shares.write_text(SHARE_HEADER)
shutil.copyfile(template, assumptions)
universe.parent.mkdir(parents=True, exist_ok=True)
entry = {
    'company_id': args.company_id, 'company': args.company, 'bse_scrip': args.bse_scrip,
    'isin': args.isin.upper(), 'sector': args.sector, 'coverage_status': 'scaffolded',
    'notes': 'Workspace created; official statement records, shares and assumptions require review.'}
updated = [entry if row['company_id'] == args.company_id else row for row in existing_universe]
if not existing_entry:
    updated.append(entry)
with universe.open('w', newline='') as handle:
    writer = csv.DictWriter(handle, fieldnames=list(entry))
    writer.writeheader(); writer.writerows(updated)
workspace = root / 'data/workspaces' / args.company_id
workspace.mkdir(parents=True, exist_ok=True)
(workspace / 'package.json').write_text(json.dumps({
    'reviewed': False,
    'company': {'id': args.company_id, 'name': args.company, 'ticker': args.ticker,
                'scrip': args.bse_scrip, 'isin': args.isin.upper(), 'sector': args.sector,
                'officialDomain': args.official_domain, 'currency': 'INR', 'unit': 'INR crore',
                'historical': [], 'facts': [], 'sources': [], 'shares': {}, 'assumptions': {}},
    'snapshot': {'annuals': [], 'share_observations': []}}, indent=2) + '\n')
print(f"Created scaffolded workspace for {args.company_id}. It is not in config/company_registry.csv and cannot run valuation until explicitly activated.")
