"""SQLite WAL persistence and online backups for immutable valuation snapshots."""
from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from typing import Iterator
import uuid


class ResearchStore:
    """Keep immutable run contents while bounding retained history by age."""

    def __init__(self, path: Path, retention_days: int | None = None) -> None:
        """Open/create a WAL database; default retention is 365 days, 0 disables expiry."""
        self.path = Path(path)
        retention = int(os.environ.get('RESEARCH_RETENTION_DAYS', '365')) if retention_days is None else retention_days
        if isinstance(retention, bool) or not isinstance(retention, int) or not 0 <= retention <= 36500:
            raise ValueError('Retention days must be an integer between 0 and 36500.')
        self.retention_days = retention
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS valuation_runs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, created_at TEXT NOT NULL, input_sha256 TEXT NOT NULL, assumptions_json TEXT NOT NULL, result_json TEXT NOT NULL)')
            db.execute('CREATE INDEX IF NOT EXISTS runs_company_date ON valuation_runs(company_id, created_at DESC)')
        self.prune()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        """Commit or roll back each short transaction and always close the handle."""
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def prune(self) -> int:
        """Delete expired run rows; WAL pages are reclaimed by SQLite checkpoints."""
        if not self.retention_days:
            return 0
        cutoff = (datetime.now(timezone.utc)-timedelta(days=self.retention_days)).isoformat()
        with self.connect() as db:
            return db.execute('DELETE FROM valuation_runs WHERE created_at < ?', (cutoff,)).rowcount

    def save(self, company_id: str, assumptions: dict, result: dict) -> str:
        """Persist a calculation and canonical fingerprint; never store credentials."""
        canonical = json.dumps({'company_id':company_id,'assumptions':assumptions,'source_manifest':result.get('inputManifest'),'market_evidence':result.get('marketEvidence')},sort_keys=True,separators=(',',':'),allow_nan=False)
        run_id = str(uuid.uuid4()); created = datetime.now(timezone.utc).isoformat()
        with self.connect() as db:
            db.execute('INSERT INTO valuation_runs VALUES (?,?,?,?,?,?)', (run_id,company_id,created,hashlib.sha256(canonical.encode()).hexdigest(),json.dumps(assumptions,allow_nan=False),json.dumps(result,allow_nan=False)))
        self.prune()
        return run_id

    def list_runs(self, company_id: str | None = None, limit: int = 30) -> list[dict]:
        """Return bounded run metadata, optionally filtered by issuer."""
        limit = min(100, max(1, int(limit)))
        with self.connect() as db:
            if company_id:
                rows = db.execute('SELECT id,company_id,created_at,input_sha256 FROM valuation_runs WHERE company_id=? ORDER BY created_at DESC LIMIT ?', (company_id,limit)).fetchall()
            else:
                rows = db.execute('SELECT id,company_id,created_at,input_sha256 FROM valuation_runs ORDER BY created_at DESC LIMIT ?', (limit,)).fetchall()
        return [dict(row) for row in rows]

    def backup(self, target: Path) -> None:
        """Create a consistent online SQLite backup, including committed WAL pages."""
        target = Path(target)
        if target.resolve() == self.path.resolve() or target.exists():
            raise ValueError('Choose a new backup path different from the live database.')
        target.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive reservation prevents accidental overwrite between validation and opening.
        with target.open('xb'):
            pass
        try:
            with self.connect() as source:
                destination = sqlite3.connect(target)
                try:
                    source.backup(destination)
                    if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise ValueError('Backup integrity check failed.')
                finally:
                    destination.close()
        except Exception:
            target.unlink(missing_ok=True)
            raise
