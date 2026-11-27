"""Onboarding contracts; synthetic second-company fixtures are never production data."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
sys.path.insert(0, str(ROOT))
from company_workspace import activate, validate_package, snapshot_for
from backend import python_service


def fixture():
    company = copy.deepcopy(json.loads((ROOT / 'data/companies.json').read_text())['companies'][0])
    company['sources'] = [s for s in company['sources'] if s['kind'] == 'Financial statements']
    company.update(id='synthetic_test_only', name='Synthetic test only', officialDomain='infosys.com')
    snapshot = json.loads((ROOT / 'data/source_snapshot.json').read_text())
    return {'reviewed': True, 'company': company, 'snapshot': snapshot}


class CompanyWorkspaceTests(unittest.TestCase):
    def test_each_registered_company_passes_twelve_checks(self):
        for company in json.loads((ROOT / 'data/companies.json').read_text())['companies']:
            with self.subTest(company=company['id']):
                checks = python_service.dispatch({'companyId': company['id']})['reconciliations']
                self.assertEqual(len(checks), 12)
                self.assertTrue(all(c['status'] == 'pass' for c in checks))

    def test_second_company_activates_without_cross_company_snapshot_leakage(self):
        package = fixture()
        # Change both source-backed representations; accounting identities stay intact.
        package['snapshot']['annuals'][-1]['revenue'] += 1000
        package['company']['historical'][-1]['revenue'] += 1000
        next(f for f in package['company']['facts'] if f['year'] == 2026 and f['field'] == 'revenue')['value'] += 1000
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / 'data').mkdir()
            (root / 'data/companies.json').write_text((ROOT / 'data/companies.json').read_text())
            (root / 'data/source_snapshot.json').write_text((ROOT / 'data/source_snapshot.json').read_text())
            activate(root, package)
            bundle = json.loads((root / 'data/companies.json').read_text())
            self.assertEqual(len(bundle['companies']), 2)
            old = python_service.ROOT
            try:
                python_service.ROOT = root
                for registered in bundle['companies']:
                    checks = python_service.dispatch({'companyId': registered['id']})['reconciliations']
                    self.assertEqual(len(checks),12)
                    self.assertTrue(all(c['status']=='pass' for c in checks))
                second = python_service.dispatch({'companyId': 'synthetic_test_only'})
                self.assertEqual(len(second['reconciliations']), 12)
                self.assertTrue(all(c['status'] == 'pass' for c in second['reconciliations']))
                self.assertEqual(second['analytics']['annuals'][-1]['fiscal_year'], 2026)
                self.assertEqual(second['market'], None)
                self.assertEqual(second['forecast'][0]['revenue'], package['company']['historical'][-1]['revenue'] * 1.09)
            finally:
                python_service.ROOT = old
            with self.assertRaises(ValueError): activate(root, package)

    def test_missing_or_unofficial_provenance_blocks_activation(self):
        for key, value in [('pdfPage', None), ('sourceUrl', 'https://example.com/report.pdf'), ('publicationDate', None), ('unit', 'USD million')]:
            package = fixture(); package['company']['facts'][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): validate_package(package)
        package = fixture(); package['reviewed'] = False
        with self.assertRaises(ValueError): validate_package(package)

    def test_mismatched_statement_and_share_evidence_is_rejected(self):
        package = fixture(); package['company']['shares']['netCrore'] += 1
        with self.assertRaises(ValueError): validate_package(package)
        package = fixture(); package['company']['historical'][0]['assets'] += 10
        with self.assertRaises(ValueError): validate_package(package)

    def test_no_cross_company_fallback_or_path_escape(self):
        for company in [{'id': 'other'}, {'id':'other', 'snapshotPath':'../secret.json'}]:
            with self.assertRaises(ValueError): snapshot_for(ROOT, company)

class WorkspaceCommandTests(unittest.TestCase):
    def test_existing_peer_can_be_scaffolded_without_duplicate_universe_rows(self):
        import csv
        import shutil
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'scripts').mkdir();(root/'config').mkdir();(root/'data').mkdir()
            shutil.copy(ROOT/'scripts/create_company_workspace.py',root/'scripts')
            shutil.copy(ROOT/'config/assumptions_template.json',root/'config')
            shutil.copy(ROOT/'data/company_universe.csv',root/'data')
            command=[sys.executable,'-S',str(root/'scripts/create_company_workspace.py'),'--company-id','tcs','--company','Tata Consultancy Services Limited','--bse-scrip','532540','--isin','INE467B01029','--sector','Information Technology','--official-domain','tcs.com','--ticker','TCS']
            first= subprocess.run(command,capture_output=True,text=True)
            self.assertEqual(first.returncode,0,first.stderr)
            with (root/'data/company_universe.csv').open() as handle:
                rows=list(csv.DictReader(handle))
            self.assertEqual(sum(r['company_id']=='tcs' for r in rows),1)
            self.assertEqual(next(r for r in rows if r['company_id']=='tcs')['coverage_status'],'scaffolded')
            package=json.loads((root/'data/workspaces/tcs/package.json').read_text())
            self.assertFalse(package['reviewed']);self.assertEqual(package['company']['officialDomain'],'tcs.com')
            before=(root/'data/company_universe.csv').read_bytes()
            self.assertNotEqual(subprocess.run(command,capture_output=True).returncode,0)
            self.assertEqual((root/'data/company_universe.csv').read_bytes(),before)

    def test_activation_command_runs_without_site_packages_and_fingerprints_evidence(self):
        import shutil
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'scripts').mkdir();(root/'data').mkdir()
            shutil.copy(ROOT/'scripts/activate_company.py',root/'scripts')
            shutil.copytree(ROOT/'src',root/'src',ignore=shutil.ignore_patterns('__pycache__'))
            shutil.copy(ROOT/'data/companies.json',root/'data')
            package_path=root/'reviewed-package.json';package_path.write_text(json.dumps(fixture()))
            completed=subprocess.run([sys.executable,'-S',str(root/'scripts/activate_company.py'),'--package',str(package_path)],capture_output=True,text=True)
            self.assertEqual(completed.returncode,0,completed.stderr)
            company=json.loads((root/'data/companies.json').read_text())['companies'][-1]
            self.assertEqual(company['id'],'synthetic_test_only')
            self.assertIn('annuals',snapshot_for(root,company))
            (root/company['snapshotPath']).write_text('{}')
            with self.assertRaises(ValueError):snapshot_for(root,company)

    def test_reference_data_refresh_preserves_other_registered_issuers(self):
        import csv
        import shutil
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'scripts').mkdir()
            shutil.copy(ROOT/'scripts/prepare_data.py',root/'scripts')
            shutil.copytree(ROOT/'data',root/'data',ignore=shutil.ignore_patterns('runtime','processed'))
            bundle_path=root/'data/companies.json';bundle=json.loads(bundle_path.read_text());bundle['companies'].append(fixture()['company']);bundle_path.write_text(json.dumps(bundle))
            universe=root/'data/company_universe.csv'
            with universe.open(newline='') as handle:rows=list(csv.DictReader(handle))
            for row in rows:
                if row['company_id']=='tcs':row['coverage_status']='scaffolded'
            with universe.open('w',newline='') as handle:
                writer=csv.DictWriter(handle,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
            result=subprocess.run([sys.executable,'-S',str(root/'scripts/prepare_data.py')],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual([c['id'] for c in json.loads(bundle_path.read_text())['companies']],['infosys','synthetic_test_only'])
            with universe.open(newline='') as handle:updated=list(csv.DictReader(handle))
            self.assertEqual(next(r for r in updated if r['company_id']=='tcs')['coverage_status'],'scaffolded')
