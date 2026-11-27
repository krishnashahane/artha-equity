/** Terminal surface: renders Python/reviewed values only and handles commands safely. */
import test from 'node:test';
import assert from 'node:assert/strict';
const elements=new Map();
function element(selector){
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',inert:false,style:{},dataset:{},classList:{add(){},remove(){}},addEventListener(){},querySelectorAll(){return [];},focus(){},scrollIntoView(){},isConnected:true,tagName:'DIV'});
  return elements.get(selector);
}
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.location={hash:''};
globalThis.window={addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})};
globalThis.document={querySelector:element,querySelectorAll:()=>[],addEventListener(){},activeElement:element('active'),documentElement:{dataset:{}},body:{style:{}}};

test('terminal renders evidence-labelled Python values for the active issuer',async()=>{
  const app=await import('../dist/app.js');const {state}=await import('../dist/state.js');
  app.go('terminal');const html=element('#app').innerHTML;
  assert.match(html,/ARTHA<b>▸<\/b>TERMINAL/);assert.match(html,/<h1/);
  for(const label of ['FACT','ASM','CALC','INTERP'])assert.ok(html.includes('>'+label+'<'),label);
  assert.ok(html.includes(new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(state.r.perShare)));
  assert.match(html,/PX LAST/);assert.match(html,/N\/A/);
  for(const id of ['dcf','gp','asm','fa','fcff','sens','comp','chk','des','evid','console'])assert.ok(html.includes(`id="t-${id}"`),id);
  app.go('company');assert.doesNotMatch(element('#app').innerHTML,/t-panel/);
});
test('terminal commands validate input and never fabricate peer valuations',async()=>{
  const app=await import('../dist/app.js');const t=await import('../dist/terminal.js');const {state}=await import('../dist/state.js');
  app.go('terminal');
  const wacc=state.a.wacc;await t.runCommand('WACC 500');assert.equal(state.a.wacc,wacc);assert.match(t.term.log.at(-1).text,/Usage: WACC/);
  await t.runCommand('LOAD TCS');assert.match(t.term.log.at(-1).text,/comparison-only/);assert.equal(state.r.calculationAuthority,'python');
  await t.runCommand('GROW 1 2');assert.match(t.term.log.at(-1).text,/five annual/);
  await t.runCommand('SRCH FY2026 revenue');assert.match(t.term.log.at(-1).text,/reviewed facts match/);
  await t.runCommand('<img src=x onerror=alert(1)>');assert.ok(!element('#app').innerHTML.includes('<img src=x'));
  await t.runCommand('BEAR');assert.equal(state.scenario,'bear');
  await t.runCommand('HELP');assert.match(t.term.log.at(-1).html,/RDCF/);
  await t.runCommand('CLR');assert.equal(t.term.log.length,0);
});
