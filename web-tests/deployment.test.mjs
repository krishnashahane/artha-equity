import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../backend/server.mjs';
import {spawnSync} from 'node:child_process';
import {resolvePython} from '../backend/python_path.mjs';
test('deployment protects UI and API without revealing a password',async()=>{
  const server=createServer({password:'synthetic-test-only',username:'research'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const url='http://127.0.0.1:'+server.address().port;const denied=await fetch(url+'/api/companies');assert.equal(denied.status,401);assert.match(denied.headers.get('www-authenticate'),/Basic/);assert.ok(!(await denied.text()).includes('synthetic-test-only'));const allowed=await fetch(url+'/api/companies',{headers:{Authorization:'Basic '+Buffer.from('research:synthetic-test-only').toString('base64')}});assert.equal(allowed.status,200);const health=await fetch(url+'/api/health');assert.equal(health.status,200);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('production Python calculations run without third-party site packages',()=>{
  const python=resolvePython();
  const run=spawnSync(python,['-S','backend/python_service.py'],{cwd:new URL('..',import.meta.url),input:JSON.stringify({companyId:'infosys'}),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.valid,true);assert.equal(result.calculationAuthority,'python');assert.ok(result.perShare>0);assert.equal(result.peerImpliedValues.pe.peer_count,0);
});
