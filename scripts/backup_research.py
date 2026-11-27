"""Back up the run database using SQLite's WAL-aware online backup API."""
from pathlib import Path
import argparse
import sys
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / 'src'))
from research_store import ResearchStore

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=ROOT / 'data/runtime/research.sqlite3')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not args.database.is_file():
        raise SystemExit('Backup rejected: source database does not exist.')
    # Do not expire history as a side effect of taking a backup.
    ResearchStore(args.database, retention_days=0).backup(args.output)
    print('Backup PASS: SQLite integrity_check=ok')
