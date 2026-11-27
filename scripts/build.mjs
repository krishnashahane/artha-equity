import {cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
cpSync(path.join(root,'public'),out,{recursive:true});
const data=JSON.parse(readFileSync(path.join(root,'data/companies.json'),'utf8'));
let previewReady=false;
for(const python of [process.env.PYTHON_EXECUTABLE,process.env.CODEX_PRIMARY_RUNTIME_PYTHON,'python3','python'].filter(Boolean)){
  const result=spawnSync(python,[path.join(root,'scripts/prepare_preview.py')],{cwd:root,encoding:'utf8',maxBuffer:5*1024*1024});
  if(result.status===0){data.precomputed=JSON.parse(result.stdout);previewReady=true;break;}
  if(result.error?.code!=='ENOENT')throw new Error(result.stderr||'Python preview compilation failed.');
}
if(!previewReady)throw new Error('Python 3 is required to build the reviewed model snapshot.');
writeFileSync(path.join(out,'data.js'),'// Generated from reviewed data/companies.json.\nexport default '+JSON.stringify(data)+';\n');
mkdirSync(path.join(out,'downloads'),{recursive:true});
let zipped=false;
for(const python of [process.env.PYTHON_EXECUTABLE,process.env.CODEX_PRIMARY_RUNTIME_PYTHON,'python3','python'].filter(Boolean)){
  const r=spawnSync(python,[path.join(root,'scripts/package_source.py'),path.join(out,'downloads/artha-equity-project.zip')],{cwd:root,encoding:'utf8'});
  if(r.status===0){console.log(r.stdout.trim());zipped=true;break;}
  if(r.error?.code!=='ENOENT')throw new Error(r.stderr||'Source packaging failed.');
}
if(!zipped)throw new Error('Python 3 is required to package the downloadable source archive.');
console.log('Built Artha: desktop interface, Python-compiled cases, reviewed evidence and source download.');
