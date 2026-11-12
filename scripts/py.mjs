/** Run Python with the project's resolved interpreter (PYTHON_EXECUTABLE → .venv → python3). */
import {spawnSync} from 'node:child_process';
import {root,resolvePython} from '../backend/python_path.mjs';
const r=spawnSync(resolvePython(),process.argv.slice(2),{cwd:root,stdio:'inherit'});
if(r.error){console.error(r.error.code==='ENOENT'?'Python 3 was not found. Install it or set PYTHON_EXECUTABLE.':r.error.message);process.exit(1);}
process.exit(r.status??1);
