/** Single source of truth for locating the Python interpreter used by the app, build and tests. */
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

/** Ordered, de-duplicated interpreter candidates: explicit override → project venv → system. */
export function pythonCandidates(){
  const venv=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const list=[process.env.PYTHON_EXECUTABLE,process.env.CODEX_PRIMARY_RUNTIME_PYTHON,existsSync(venv)?venv:null,process.platform==='win32'?'python':'python3','python'];
  return [...new Set(list.filter(Boolean))];
}

/** The preferred interpreter (first candidate). */
export function resolvePython(){return pythonCandidates()[0];}
