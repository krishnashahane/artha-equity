"""Local SQLite persistence for immutable valuation snapshots, not user secrets."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sqlite3
import uuid
from datetime import datetime,timezone

class ResearchStore:
    def __init__(self,path:Path):
        self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS valuation_runs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, input_sha256 TEXT NOT NULL, assumptions_json TEXT NOT NULL, result_json TEXT NOT NULL)')
            db.execute('CREATE INDEX IF NOT EXISTS runs_company_date ON valuation_runs(company_id, created_at DESC)')
    def connect(self):
        db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row;return db
    def save(self,company_id,assumptions,result):
        canonical=json.dumps({'company_id':company_id,'assumptions':assumptions,'source_manifest':result.get('inputManifest'),'market_evidence':result.get('marketEvidence')},sort_keys=True,separators=(',',':'),allow_nan=False)
        run_id=str(uuid.uuid4());date=datetime.now(timezone.utc).isoformat()
        with self.connect() as db:db.execute('INSERT INTO valuation_runs VALUES (?,?,?,?,?,?)',(run_id,company_id,date,hashlib.sha256(canonical.encode()).hexdigest(),json.dumps(assumptions,allow_nan=False),json.dumps(result,allow_nan=False)))
        return run_id
    def list_runs(self,company_id=None,limit=30):
        with self.connect() as db:
            if company_id:rows=db.execute('SELECT id,company_id,created_at,input_sha256 FROM valuation_runs WHERE company_id=? ORDER BY created_at DESC LIMIT ?',(company_id,min(100,max(1,int(limit))))).fetchall()
            else:rows=db.execute('SELECT id,company_id,created_at,input_sha256 FROM valuation_runs ORDER BY created_at DESC LIMIT ?',(min(100,max(1,int(limit))),)).fetchall()
        return [dict(row) for row in rows]
