"""Fingerprint exactly the reviewed input files attached to a research packet."""
import hashlib
from pathlib import Path

def build_input_manifest(root: Path) -> dict:
    paths = sorted([p for p in (root/'config').rglob('*') if p.is_file()] + [p for directory in ['raw','shares','market','peers'] for p in (root/'data'/directory).glob('*.csv')])
    snapshot=root/'data/source_snapshot.json'
    if snapshot.exists(): paths.append(snapshot)
    return {'schema_version':'1.0','input_files':[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]}
