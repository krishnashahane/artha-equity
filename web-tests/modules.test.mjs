/** Smoke the actual built ES-module graph with a minimal DOM boundary.
 * Browser visual/AT checks remain a separate manual validation requirement.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
const elements=new Map();
function element(selector){
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',inert:false,style:{},classList:{add(){},remove(){}},addEventListener(){},querySelectorAll(){return [];},focus(){},scrollIntoView(){},isConnected:true,tagName:'DIV'});
  return elements.get(selector);
}
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.location={hash:''};
globalThis.window={addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})};
globalThis.document={querySelector:element,querySelectorAll:()=>[],addEventListener(){},activeElement:element('active'),documentElement:{dataset:{}},body:{style:{}}};
test('native module graph boots and renders every view without calculations',async()=>{
  const app=await import('../dist/app.js');const views=await import('../dist/views.js');const {state}=await import('../dist/state.js');
  for(const view of ['company','valuation','research']){app.go(view);assert.ok(element('#app').innerHTML.includes('<h1>'));}
  app.chooseCase('bull');assert.equal(state.scenario,'bull');assert.equal(state.r.calculationAuthority,'python');
  assert.match(views.valuationView(),/Monte Carlo/);assert.match(views.valuationView(),/Reverse DCF/);
});
test('charts expose Python-provided values and accessible descriptions',async()=>{
  const charts=await import('../dist/charts.js');const {state}=await import('../dist/state.js');
  const waterfall=charts.waterfallChart(state.r.bridge);assert.match(waterfall,/aria-labelledby/);assert.match(waterfall,/Equity value/);
  const histogram=charts.histogramChart([{low:10,high:20,count:100}]);assert.match(histogram,/<table/);assert.match(histogram,/100 simulations/);
});
test('dialog lifecycle makes the background inert and restores it',async()=>{
  const dialogs=await import('../dist/dialogs.js');dialogs.dialog('Test','Body');assert.equal(element('#app').inert,true);
  assert.match(element('#dialog-root').innerHTML,/aria-modal="true"/);dialogs.closeDialog();assert.equal(element('#app').inert,false);
});
test('deployable engine has no valuation or multiple calculation exports',async()=>{
  const engine=await import('../dist/engine.js');assert.equal(engine.calculate,undefined);assert.equal(engine.peerMetrics,undefined);assert.equal(engine.sensitivity,undefined);
});
test('selector renders a synthetic second issuer with its own compiled values and periods',async()=>{
  const app=await import('../dist/app.js');const {dataset,compiled,state}=await import('../dist/state.js');
  const synthetic=structuredClone(dataset.companies[0]);synthetic.id='synthetic_ui_test';synthetic.name='Synthetic UI test';synthetic.ticker='SYNTH';synthetic.historical.forEach((h,i)=>h.year=2021+i);
  dataset.companies.push(synthetic);compiled.cases[synthetic.id]=structuredClone(compiled.cases.infosys);compiled.cases[synthetic.id].base.perShare=123;
  try{app.selectCompany(synthetic.id);app.go('company');assert.match(element('#app').innerHTML,/Synthetic UI test/);assert.match(element('#app').innerHTML,/FY2021–FY2023/);assert.equal(state.r.perShare,123);assert.equal(state.messages.length,0);}
  finally{app.selectCompany('infosys');dataset.companies.pop();delete compiled.cases[synthetic.id];}
});
test('resetting a conversation discards an in-flight response',async()=>{
  const {runtime,state}=await import('../dist/state.js'),{ask}=await import('../dist/api.js'),{handle}=await import('../dist/app.js');
  const previous=globalThis.fetch;let resolve;runtime.api=true;
  globalThis.fetch=()=>new Promise(r=>resolve=r);
  try{
    const pending=ask('Explain revenue');assert.equal(state.asking,true);handle('new-chat');assert.equal(state.asking,false);
    resolve(new Response(JSON.stringify({title:'Old response',body:'Old company context',citations:[]})));await pending;
    assert.deepEqual(state.messages,[]);assert.equal(state.asking,false);
  }finally{globalThis.fetch=previous;runtime.api=false;}
});
