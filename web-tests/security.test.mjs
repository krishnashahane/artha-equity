import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../backend/server.mjs';

let server,origin;
test.before(async()=>{server=createServer({password:'',rateLimit:1000});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});
test.after(()=>new Promise(r=>server.close(r)));
const raw=(route,body,headers={})=>fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});

test('responses carry hardened security headers',async()=>{
  const r=await fetch(origin+'/api/health');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');
  assert.match(r.headers.get('content-security-policy'),/object-src 'none'/);
  assert.ok(r.headers.get('permissions-policy'));
  const body=await r.json();assert.match(body.version,/^\d+\.\d+\.\d+$/);
});
test('malformed JSON is a 400, not a crash',async()=>{const r=await raw('/api/valuation','{not json');assert.equal(r.status,400);});
test('non-object JSON bodies are rejected',async()=>{const r=await raw('/api/valuation','[1,2,3]');assert.equal(r.status,400);});
test('non-object assumptions are rejected before reaching Python',async()=>{const r=await raw('/api/valuation',JSON.stringify({companyId:'infosys',assumptions:'oops'}));assert.equal(r.status,400);});
test('wrong-type assumptions never leak a Python traceback',async()=>{
  const r=await raw('/api/valuation',JSON.stringify({companyId:'infosys',assumptions:{wacc:'x'}})),text=await r.text();
  assert.ok([400,422].includes(r.status));assert.ok(!/Traceback|File "/.test(text));
});
test('a "null" Origin header is rejected for writes',async()=>{const r=await raw('/api/valuation',JSON.stringify({companyId:'infosys'}),{Origin:'null'});assert.equal(r.status,403);});
test('wrong content type is rejected',async()=>{const r=await fetch(origin+'/api/valuation',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'});assert.equal(r.status,415);});
test('unknown API endpoints return 404 without running a valuation',async()=>{const r=await raw('/api/nope',JSON.stringify({}));assert.equal(r.status,404);});
test('path traversal outside dist is refused',async()=>{
  for(const p of ['/..%2f..%2fpackage.json','/%2e%2e/%2e%2e/etc/passwd']){const r=await fetch(origin+p);assert.ok([403,404].includes(r.status),p+' → '+r.status);}
});
test('malformed percent-encoding is a 400',async()=>{const r=await fetch(origin+'/%E0%A4%A');assert.equal(r.status,400);});
test('runs listing rejects unknown companies',async()=>{const r=await fetch(origin+'/api/runs?companyId=../../x');assert.equal(r.status,400);});

test('repeated failed sign-ins are throttled',async()=>{
  const locked=createServer({password:'synthetic-test-only-pw',username:'research'});
  await new Promise(r=>locked.listen(0,'127.0.0.1',r));
  try{
    const url='http://127.0.0.1:'+locked.address().port+'/api/companies',bad={Authorization:'Basic '+Buffer.from('research:wrong').toString('base64')};
    let last;for(let i=0;i<21;i++)last=(await fetch(url,{headers:bad})).status;
    assert.equal(last,429);
  }finally{await new Promise(r=>locked.close(r));}
});
