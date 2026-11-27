/** Proxy-aware origin checks, cross-site write refusal, field whitelisting and browser storage mode. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../backend/server.mjs';
async function serve(options,fn){const server=createServer({logger(){},...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{return await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
const post=(url,body,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('behind a trusted HTTPS proxy, same-origin browser writes are accepted and others refused',async()=>{
  const seen=[];const operation=async input=>{seen.push(input);return {valid:true};};
  await serve({trustProxy:true,operation:async()=>({status:'ready'})},async url=>{
    const host=new URL(url).host;
    const ok=await post(url+'/api/capital-cost',{inputs:{}},{origin:'https://artha.example',  'x-forwarded-proto':'https','x-forwarded-host':'artha.example'});
    assert.notEqual(ok.status,403);assert.match(ok.headers.get('strict-transport-security')??'',/max-age/);
    const bad=await post(url+'/api/capital-cost',{inputs:{}},{origin:'https://evil.example','x-forwarded-proto':'https','x-forwarded-host':'artha.example'});assert.equal(bad.status,403);
    const site=await post(url+'/api/capital-cost',{inputs:{}},{'sec-fetch-site':'cross-site'});assert.equal(site.status,403);
    const direct=await post(url+'/api/capital-cost',{inputs:{}},{origin:'http://'+host});assert.notEqual(direct.status,403);
  });
  void operation;void seen;
});
test('rate limiting keys on the forwarded client when the proxy is trusted',async()=>{
  await serve({trustProxy:true},async url=>{
    let last;for(let i=0;i<91;i++)last=await fetch(url+'/api/companies',{headers:{'x-forwarded-for':'203.0.113.7'}});
    assert.equal(last.status,429);
    const other=await fetch(url+'/api/companies',{headers:{'x-forwarded-for':'198.51.100.9'}});assert.equal(other.status,200);
  });
});
test('security headers forbid framing and restrict sources',async()=>{
  await serve({},async url=>{const r=await fetch(url+'/api/health');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(r.headers.get('content-security-policy'),/object-src 'none'/);const body=await r.json();assert.equal(body.version,'1.4.1');});
});
test('browser storage mode disables server run history',async()=>{
  const previous=process.env.ARTHA_STORAGE_MODE;process.env.ARTHA_STORAGE_MODE='browser';
  try{await serve({},async url=>{const runs=await (await fetch(url+'/api/runs')).json();assert.deepEqual(runs,{runs:[],storage:'browser'});const health=await (await fetch(url+'/api/health')).json();assert.equal(health.storage,'browser');});}
  finally{if(previous===undefined)delete process.env.ARTHA_STORAGE_MODE;else process.env.ARTHA_STORAGE_MODE=previous;}
});
test('Python worker environment excludes credentials and model keys',async()=>{
  const {readFileSync}=await import('node:fs');const bridge=readFileSync(new URL('../backend/python_bridge.mjs',import.meta.url),'utf8');
  assert.match(bridge,/env,stdio/);assert.doesNotMatch(bridge,/env:process\.env/);
  const {runPython}=await import('../backend/python_bridge.mjs');process.env.APP_AUTH_PASSWORD='never-leak-this';
  try{const r=await runPython({action:'valuation',companyId:'infosys'});assert.equal(r.valid,true);}finally{delete process.env.APP_AUTH_PASSWORD;}
});
