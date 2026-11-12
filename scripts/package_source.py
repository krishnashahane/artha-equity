"""Create a portable source archive without credentials, Git data or build output."""
from pathlib import Path
import sys
import zipfile
ROOT=Path(__file__).resolve().parents[1]
target=Path(sys.argv[1])
target.parent.mkdir(parents=True,exist_ok=True)
excluded={'dist','.git','.openai','.codex','.agents','node_modules','__pycache__','.venv','downloads','coverage','runtime'}
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(ROOT.rglob('*')):
        relative=p.relative_to(ROOT)
        if not p.is_file() or any(part in excluded for part in relative.parts):continue
        if p.name.startswith('.env') and p.name!='.env.example':continue
        if p.suffix in {'.pyc','.zip','.pdf'}:continue
        if len(relative.parts)>1 and relative.parts[:2]==('data','processed'):continue
        archive.write(p,Path('artha-equity')/relative)
print('Packaged portable project: '+str(target))
