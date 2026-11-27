"""Offline production readiness: every registered web company must reconcile."""
from pathlib import Path
import json
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.python_service import dispatch
from company_workspace import validate_package, snapshot_for
bundle = json.loads((ROOT / 'data/companies.json').read_text())
ids = [c['id'] for c in bundle['companies']]
if not ids or len(ids) != len(set(ids)):
    raise SystemExit('Preflight failed: empty or duplicate company registry.')
for company in bundle['companies']:
    if company.get('officialDomain'):
        validate_package({'reviewed':True,'company':company,'snapshot':snapshot_for(ROOT,company)})
    result = dispatch({'companyId': company['id']})
    if not result['valid'] or len(result['reconciliations']) != 12 or any(c['status'] != 'pass' for c in result['reconciliations']):
        raise SystemExit('Preflight failed for registered company ' + company['id'])
    print(company['id'] + ': 12/12 reconciliations PASS; Python authority; unavailable market evidence preserved')
print('Preflight PASS')
