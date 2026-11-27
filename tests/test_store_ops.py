from pathlib import Path
from datetime import datetime, timedelta, timezone
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from research_store import ResearchStore

class StoreOpsTests(unittest.TestCase):
    def test_wal_retention_and_metadata_filter(self):
        with tempfile.TemporaryDirectory() as tmp:
            store=ResearchStore(Path(tmp)/'runs.sqlite3',retention_days=30)
            old=store.save('old',{},{});new=store.save('infosys',{},{});
            with store.connect() as db:
                self.assertEqual(db.execute('PRAGMA journal_mode').fetchone()[0],'wal')
                db.execute('UPDATE valuation_runs SET created_at=? WHERE id=?',((datetime.now(timezone.utc)-timedelta(days=31)).isoformat(),old))
            self.assertEqual(store.prune(),1);self.assertEqual(store.list_runs('infosys')[0]['id'],new)
            self.assertEqual(len(store.list_runs()),1)

    def test_online_backup_contains_committed_wal_and_rejects_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'runs.sqlite3';target=Path(tmp)/'backup.sqlite3';store=ResearchStore(path,retention_days=0)
            # Keep a connection open to exercise a live WAL database.
            with store.connect() as live:
                run=store.save('infosys',{'test':'synthetic'},{'valid':True})
                store.backup(target)
                with sqlite3.connect(target) as db:
                    self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
                    self.assertEqual(db.execute('SELECT id FROM valuation_runs').fetchone()[0],run)
            with self.assertRaises(ValueError):store.backup(target)
            with self.assertRaises(ValueError):store.backup(path)

    def test_backup_script_and_retention_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'runs.sqlite3';ResearchStore(path,0).save('test',{},{});
            result=subprocess.run([sys.executable,'-S',str(ROOT/'scripts/backup_research.py'),'--database',str(path),'--output',str(Path(tmp)/'copy.sqlite3')],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr);self.assertIn('Backup PASS',result.stdout)
            for retention in [-1,True,1.5,36501]:
                with self.assertRaises(ValueError):ResearchStore(path,retention)
