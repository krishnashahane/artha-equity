import json
from pathlib import Path
import sys
import unittest
import pandas as pd
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from equity_platform import validate_source_record_rows, validate_assumptions
from provenance import build_input_manifest

class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.records=pd.read_csv(ROOT/'data/raw/infosys_source_records.csv')
        self.a=json.loads((ROOT/'config/assumptions.json').read_text())
    def test_currency_label_cannot_masquerade_as_inr_crore(self):
        r=self.records.copy();r.loc[0,'raw_unit']='USD million'
        self.assertTrue(any('raw_unit' in e for e in validate_source_record_rows(r)))
    def test_conversion_factor_must_match_its_unit(self):
        r=self.records.copy();r.loc[0,'conversion_factor']=.1;r.loc[0,'normalized_value_inr_crore']=r.loc[0,'raw_value']*.1
        self.assertTrue(any('declared raw unit' in e for e in validate_source_record_rows(r)))
    def test_blank_source_page_is_rejected(self):
        r=self.records.copy();r['pdf_page']=r['pdf_page'].astype(object);r.loc[0,'pdf_page']=''
        self.assertTrue(any('pdf_page' in e for e in validate_source_record_rows(r)))
    def test_point_in_time_mode_cannot_use_later_information(self):
        self.a['study_mode']='point_in_time'
        self.assertTrue(any('Point-in-time' in e for e in validate_assumptions(self.a)))
    def test_provenance_manifest_is_nonempty_and_deterministic(self):
        first=build_input_manifest(ROOT)
        self.assertTrue(first['input_files'])
        self.assertEqual(first,build_input_manifest(ROOT))
        self.assertTrue(all(len(x['sha256'])==64 for x in first['input_files']))

if __name__=='__main__':unittest.main()
