import test from 'node:test';
import assert from 'node:assert/strict';
import {createPythonPool} from '../backend/python_bridge.mjs';
import {createServer} from '../backend/server.mjs';
async function serve(options,run){const server=createServer({logger:()=>{},...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
test('pool bounds concurrent workers and queue; recovers after a rejected job',async()=>{
  let running=0,max=0;const releases=[];
  const pool=createPythonPool({concurrency:2,maxQueue:1,execute:input=>new Promise((resolve,reject)=>{running++;max=Math.max(max,running);releases.push(()=>{running--;input.fail?reject(new Error('synthetic failure')):resolve(input);});})});
  const a=pool.operation({id:1}),b=pool.operation({id:2,fail:true}),c=pool.operation({id:3});
  const rejected=assert.rejects(b,/synthetic failure/);await assert.rejects(pool.operation({id:4}),/capacity/);
  assert.deepEqual(pool.stats(),{active:2,queued:1,concurrency:2,maxQueue:1});
  releases.shift()();await a;await new Promise(r=>setImmediate(r));assert.equal(pool.stats().active,2);
  releases.shift()();await rejected;releases.shift()();assert.equal((await c).id,3);assert.equal(max,2);
});
test('queued jobs time out without consuming a worker slot',async()=>{
  let release;const pool=createPythonPool({concurrency:1,maxQueue:1,queueTimeoutMs:10,execute:()=>new Promise(r=>release=r)});
  const first=pool.operation({});await assert.rejects(pool.operation({}),/queue wait timed out/);assert.equal(pool.stats().queued,0);release({});await first;
});
test('readiness checks Python and storage; failure returns 503',async()=>{
  await serve({},async origin=>{const r=await fetch(origin+'/api/ready');assert.equal(r.status,200);assert.equal((await r.json()).status,'ready');});
  await serve({operation:async()=>{throw Error('private path traceback');}},async origin=>{const r=await fetch(origin+'/api/ready');assert.equal(r.status,503);assert.deepEqual(await r.json(),{status:'unavailable'});});
});
test('JSON logs contain method/path/status/duration and exclude queries, bodies and credentials',async()=>{
  const logs=[];await serve({password:'test-password',logger:r=>logs.push(r)},async origin=>{
    await fetch(origin+'/api/companies?secret=private-query',{headers:{Authorization:'Basic '+Buffer.from('research:test-password').toString('base64')}});
    await fetch(origin+'/api/health');
  });
  assert.equal(logs.length,2);for(const r of logs){assert.deepEqual(Object.keys(r).sort(),['durationMs','method','path','status']);assert.ok(r.durationMs>=0);}
  const text=JSON.stringify(logs);assert.ok(!/private-query|test-password|Authorization/.test(text));assert.equal(logs[0].path,'/api/companies');
});
test('failed logins are throttled before comparison and readiness remains protected',async()=>{
  await serve({password:'test-password'},async origin=>{
    for(let i=0;i<10;i++)assert.equal((await fetch(origin+'/api/ready')).status,401);
    const r=await fetch(origin+'/api/ready');assert.equal(r.status,429);assert.ok(r.headers.get('retry-after'));
    assert.equal((await fetch(origin+'/api/health')).status,200);
  });
});
test('API rate limit, same-origin scheme and malformed JSON controls remain enforced',async()=>{
  await serve({},async origin=>{
    const r=await fetch(origin+'/api/valuation',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin.replace('http:','https:')},body:'{}'});assert.equal(r.status,403);
    const malformed=await fetch(origin+'/api/valuation',{method:'POST',headers:{'Content-Type':'application/json'},body:'[1,2]'});assert.equal(malformed.status,400);assert.ok(!(await malformed.text()).includes('Traceback'));
    for(let i=0;i<88;i++)assert.equal((await fetch(origin+'/api/companies')).status,200);
    assert.equal((await fetch(origin+'/api/companies')).status,429);
  });
});
test('CSP disallows inline scripts and does not add external origins',async()=>{
  await serve({},async origin=>{const r=await fetch(origin+'/api/health'),csp=r.headers.get('content-security-policy');assert.ok(csp.includes("default-src 'self'"));assert.ok(!csp.includes("script-src 'unsafe-inline'"));assert.equal(r.headers.get('x-content-type-options'),'nosniff');});
});
test('a pinned HTTPS proxy origin accepts only the exact configured origin',async()=>{
  await serve({publicOrigin:'https://research.example.com'},async origin=>{
    const post=site=>fetch(origin+'/api/capital-cost',{method:'POST',headers:{'Content-Type':'application/json',Origin:site},body:JSON.stringify({inputs:{}})});
    assert.equal((await post('https://research.example.com')).status,422);
    assert.equal((await post('http://research.example.com')).status,403);
    assert.equal((await post('https://other.example.com')).status,403);
  });
});
test('asset traversal does not expose source files',async()=>{
  await serve({},async origin=>{
    for(const route of ['/%2e%2e%2fbackend/server.mjs','/data/source_snapshot.json','/../backend/server.mjs']){
      const r=await fetch(origin+route);assert.ok([403,404].includes(r.status));assert.ok(!(await r.text()).includes('timingSafeEqual'));
    }
  });
});
test('LLM citations and numeric claims in both title and body are validated',async()=>{
  const saved={key:process.env.LLM_API_KEY,model:process.env.LLM_MODEL,url:process.env.LLM_API_URL},nativeFetch=globalThis.fetch;
  process.env.LLM_API_KEY='synthetic-test-key';process.env.LLM_MODEL='synthetic-model';process.env.LLM_API_URL='https://unit.invalid/completion';
  let response={title:'Scenario',body:'The scenario is provisional.',sourceIds:['fy26_statements']};
  globalThis.fetch=(url,options)=>String(url)==='https://unit.invalid/completion'?Promise.resolve(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(response)}}]}),{status:200,headers:{'Content-Type':'application/json'}})):nativeFetch(url,options);
  try{
    await serve({},async origin=>{
      const ask=async()=>{const r=await fetch(origin+'/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:'infosys',question:'Explain the valuation'})});assert.equal(r.status,200);return r.json();};
      assert.equal((await ask()).mode,'llm');
      response={...response,sourceIds:['invented-source']};assert.equal((await ask()).mode,'evidence');
      response={title:'Scenario',body:'The value is 999999999.',sourceIds:['fy26_statements']};assert.equal((await ask()).mode,'evidence');
      response={title:'Value 999999999',body:'The scenario is provisional.',sourceIds:['fy26_statements']};assert.equal((await ask()).mode,'evidence');
    });
  }finally{
    globalThis.fetch=nativeFetch;
    for(const [name,value] of [['LLM_API_KEY',saved.key],['LLM_MODEL',saved.model],['LLM_API_URL',saved.url]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
});
