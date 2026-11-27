import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../backend/server.mjs';
import {spawnSync} from 'node:child_process';
test('deployment protects UI and API without revealing a password',async()=>{
  const server=createServer({password:'synthetic-test-only',username:'research'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const url='http://127.0.0.1:'+server.address().port;const denied=await fetch(url+'/api/companies');assert.equal(denied.status,401);assert.match(denied.headers.get('www-authenticate'),/Basic/);assert.ok(!(await denied.text()).includes('synthetic-test-only'));const allowed=await fetch(url+'/api/companies',{headers:{Authorization:'Basic '+Buffer.from('research:synthetic-test-only').toString('base64')}});assert.equal(allowed.status,200);const health=await fetch(url+'/api/health');assert.equal(health.status,200);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('production Python calculations run without third-party site packages',()=>{
  const python=process.env.PYTHON_EXECUTABLE||process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3';
  const run=spawnSync(python,['-S','backend/python_service.py'],{cwd:new URL('..',import.meta.url),input:JSON.stringify({companyId:'infosys'}),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.valid,true);assert.equal(result.calculationAuthority,'python');assert.ok(result.perShare>0);assert.equal(result.peerImpliedValues.pe.peer_count,0);
});
test('deployment bundle config requires credentials and persists runtime data',async()=>{
  const {readFileSync}=await import('node:fs');
  const compose=readFileSync(new URL('../compose.yaml',import.meta.url),'utf8');
  assert.match(compose,/APP_AUTH_PASSWORD:\s*\$\{APP_AUTH_PASSWORD:\?/);
  assert.match(compose,/artha-research:\/app\/data\/runtime/);
  assert.match(compose,/HOST: 0\.0\.0\.0/);
  assert.match(compose,/PORT: '3000'/);
  const ignore=readFileSync(new URL('../.dockerignore',import.meta.url),'utf8');
  assert.match(ignore,/^\.env$/m);assert.match(ignore,/^!\.env.example$/m);
});
