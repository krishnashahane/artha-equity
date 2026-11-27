/** Artha Terminal: a dense, keyboard-first research console.
 * Presentation only. Every financial value shown here is a reviewed source fact,
 * a user assumption, or a Python calculation; the browser computes none of them.
 */
import {$,e,n,money,percent,dated,company,peers,cases,state,runtime,dataset,clone,event,toast,compiled} from './state.js';
import {api,refresh,ask} from './api.js';
import {retrieveEvidence} from './retrieval.js';

/** Evidence labels the handoff requires on every number: fact, assumption, calculation, interpretation. */
const tag=kind=>`<span class="t-tag t-tag-${kind}" title="${{fact:'Reported fact from a reviewed filing',asm:'Analyst assumption',calc:'Python calculation',interp:'Interpretation of evidence'}[kind]}">${{fact:'FACT',asm:'ASM',calc:'CALC',interp:'INTERP'}[kind]}</span>`;
const safeUrl=u=>{try{const x=new URL(String(u));return x.protocol==='https:'?x.href:null;}catch{return null;}};
const pct=v=>typeof v==='number'&&Number.isFinite(v)?n(v*100,1)+'%':'—';
const sign=v=>typeof v!=='number'||!Number.isFinite(v)?'':v>0?'t-up':v<0?'t-down':'';
const arrow=v=>typeof v!=='number'||!Number.isFinite(v)?'':v>0?'▲':v<0?'▼':'■';

/** Command catalogue. Codes are short mnemonics; arguments follow a space. */
export const COMMANDS=[
  ['HELP','List commands'],['DES','Company description and identifiers'],['FA','Financial statements FY history'],['GP','Graph · GP REV | EBIT | CFO | FCFF'],
  ['DCF','FCFF valuation and equity bridge'],['SENS','WACC × terminal growth sensitivity'],['COMP','Peer comparison'],['CHK','Accounting reconciliations'],
  ['EVID','Sources, pages and publication dates'],['ASM','Open the full assumptions editor'],['BASE','Load base case'],['BULL','Load bull case'],['BEAR','Load bear case'],
  ['WACC','Set WACC · WACC 11.5'],['TG','Set terminal growth · TG 4.5'],['GROW','Set five growth rates · GROW 9 8 7 6 5'],['MARGIN','Set operating margin · MARGIN 21'],
  ['TAX','Set operating tax · TAX 25'],['DA','Set D&A / revenue · DA 2.7'],['CAPEX','Set capex / revenue · CAPEX 1.6'],['NWC','Set working capital / revenue · NWC 17'],['MC','Monte Carlo · MC 1000'],['RDCF','Reverse DCF for a hypothetical price · RDCF 1500'],
  ['ASK','Ask the research assistant · ASK what drives FCFF?'],['SRCH','BM25 search over reviewed facts · SRCH FY2026 revenue'],
  ['LOAD','Load a company · LOAD INFY'],['EXP','Export research packet'],['CSV','Download forecast CSV'],['CLR','Clear console'],['EXIT','Return to the standard workspace']
];
const FIELD_COMMAND={margin:'MARGIN',tax:'TAX',wacc:'WACC',terminalGrowth:'TG',daRatio:'DA',capexRatio:'CAPEX',nwcRatio:'NWC'};
const FKEYS=[['F1','HELP'],['F2','DES'],['F3','FA'],['F4','DCF'],['F6','SENS'],['F7','COMP'],['F8','EVID'],['F9','MC']];
const PANEL_FOR={DES:'des',FA:'fa',GP:'gp',DCF:'dcf',SENS:'sens',COMP:'comp',CHK:'chk',EVID:'evid',ASK:'console',SRCH:'console',MC:'console',RDCF:'console',HELP:'console',WACC:'asm',TG:'asm',GROW:'asm',MARGIN:'asm',TAX:'asm',DA:'asm',CAPEX:'asm',NWC:'asm',BASE:'dcf',BULL:'dcf',BEAR:'dcf'};

/** Terminal-specific state lives beside the shared workspace state. */
export const term=state.term??(state.term={log:[],history:[],cursor:-1,input:'',focus:null,chart:'revenue',mc:null,rdcf:null,pending:false});

function log(kind,text,html='',extra={}){term.log.push({kind,text,html,time:istTime(false),...extra});term.log=term.log.slice(-60);}
const actions={};
/** Wire navigation helpers from app.js without a static import cycle at module-evaluation time. */
export function connectTerminal(api){Object.assign(actions,api);}

/** Parse and execute one command line. @param {string} raw */
export async function runCommand(raw){
  const line=String(raw??'').trim().slice(0,500);term.input='';
  if(!line){render();return;}
  term.history=[line,...term.history.filter(h=>h!==line)].slice(0,50);term.cursor=-1;
  const [head,...rest]=line.split(/\s+/),cmd=head.toUpperCase().replace(/<GO>$/,''),arg=rest.join(' ').replace(/\s*<GO>$/i,'').trim();
  log('cmd','> '+line);
  if(PANEL_FOR[cmd]){term.focus=PANEL_FOR[cmd];term.scroll=true;}
  const number=text=>{const v=Number(String(text).replace('%',''));return Number.isFinite(v)?v:null;};
  const setAssumption=(mutate,label)=>{
    if(!runtime.api){log('err','Custom assumptions need the Python service. This static preview has base, bull and bear cases only.');return render();}
    mutate(state.a);state.scenario='custom';event('Terminal assumption',label);log('ok',label+' → recalculating in Python');refresh();
  };
  const tickerMatch=dataset.companies.find(c=>[c.ticker,c.id,c.scrip,c.isin].some(x=>String(x).toUpperCase()===cmd));
  if(tickerMatch&&!arg){actions.selectCompany?.(tickerMatch.id);log('ok',`Loaded ${tickerMatch.name}`);term.focus='dcf';return render();}
  switch(cmd){
    case 'HELP':case '?':log('info','Commands',`<table class="t-help">${COMMANDS.map(([c,d])=>`<tr><td class="t-cmdname">${c}</td><td>${e(d)}</td></tr>`).join('')}</table><p class="t-dim">Type a ticker (e.g. INFY) and press Enter to load it. ↑/↓ recall history · Tab completes · Esc clears.</p>`);break;
    case 'DES':case 'FA':case 'DCF':case 'SENS':case 'COMP':case 'CHK':case 'EVID':break;
    case 'GP':{const k={REV:'revenue',REVENUE:'revenue',EBIT:'ebit',CFO:'cfo',FCFF:'fcff'}[arg.toUpperCase()]??'revenue';term.chart=k;break;}
    case 'BASE':case 'BULL':case 'BEAR':actions.chooseCase?.(cmd.toLowerCase());log('ok',`${cmd} case loaded`);break;
    case 'RESET':actions.chooseCase?.('base');log('ok','Base assumptions restored');break;
    case 'WACC':{const v=number(arg);if(v===null||v<=0||v>=100){log('err','Usage: WACC 11.5  (percent, between 0 and 100)');break;}setAssumption(a=>{a.wacc=v/100;},`WACC ${n(v,2)}%`);return;}
    case 'TG':{const v=number(arg);if(v===null||v<=-100||v>=100){log('err','Usage: TG 4.5  (percent; must stay below WACC)');break;}setAssumption(a=>{a.terminalGrowth=v/100;},`Terminal growth ${n(v,2)}%`);return;}
    case 'TAX':{const v=number(arg);if(v===null||v<0||v>100){log('err','Usage: TAX 25  (percent, 0–100)');break;}setAssumption(a=>{a.tax=v/100;},`Operating tax ${n(v,2)}%`);return;}
    case 'MARGIN':{const v=number(arg);if(v===null||v<-100||v>100){log('err','Usage: MARGIN 21  (percent, −100 to 100)');break;}setAssumption(a=>{a.margin=v/100;if(Array.isArray(a.margins))a.margins=a.margins.map(()=>v/100);},`Operating margin ${n(v,2)}% all years`);return;}
    case 'GROW':{const values=arg.split(/[\s,]+/).filter(Boolean).map(number);if(values.length!==5||values.some(v=>v===null||v<=-100)){log('err','Usage: GROW 9 8 7 6 5  (five annual percentages)');break;}setAssumption(a=>{a.growth=values.map(v=>v/100);},`Growth ${values.map(v=>n(v,1)).join(' / ')}%`);return;}
    case 'DA':case 'CAPEX':case 'NWC':{const v=number(arg),key={DA:'daRatio',CAPEX:'capexRatio',NWC:'nwcRatio'}[cmd];if(v===null||v>100||(cmd!=='NWC'&&v<0)||v<-100){log('err',`Usage: ${cmd} 2.5  (percent of revenue${cmd==='NWC'?'':', non-negative'})`);break;}setAssumption(a=>{a[key]=v/100;},`${cmd} ${n(v,2)}% of revenue`);return;}
    case 'ASM':actions.handle?.('assumptions');return;
    case 'EXP':actions.handle?.('export');return;
    case 'CSV':actions.handle?.('csv');log('ok','Forecast CSV downloaded');break;
    case 'CLR':case 'CLEAR':term.log=[];state.messages=[];term.mc=null;term.rdcf=null;break;
    case 'EXIT':case 'QUIT':actions.go?.('company');return;
    case 'LOAD':{const q=arg.toUpperCase(),hit=dataset.companies.find(c=>[c.ticker,c.id,c.scrip,c.isin].some(x=>String(x).toUpperCase()===q));
      if(hit){actions.selectCompany?.(hit.id);log('ok',`Loaded ${hit.name}`);term.focus='dcf';break;}
      const peer=peers.find(p=>[p.id,p.scrip,p.name].some(x=>String(x).toUpperCase()===q)||p.name.toUpperCase().startsWith(q));
      if(peer&&q){log('warn',`${peer.name} is comparison-only.`,`<p>${e(peer.name)} · BSE ${e(peer.scrip)} · FY${e(peer.year)} reported revenue ${money(peer.revenue)} Cr ${tag('fact')}</p><p class="t-dim">Its own DCF needs a reviewed company package: three consecutive consolidated periods with official source pages and release dates, a dated share count and bridge items, activated through scripts/activate_company.py (see docs/COMPANY_ONBOARDING.md). Until then it appears only in COMP.</p>`);term.focus='comp';break;}
      log('err',q?`${q}: no reviewed or peer record. Registered: ${dataset.companies.map(c=>c.ticker).join(', ')}.`:'Usage: LOAD INFY');break;}
    case 'SRCH':{if(!arg){log('err','Usage: SRCH FY2026 revenue');break;}const hits=retrieveEvidence(arg,company,peers);
      log('info',`${hits.length} reviewed facts match “${arg}”`,hits.length?`<ol class="t-list">${hits.map(d=>{const u=safeUrl(d.sourceUrl);return `<li>${tag('fact')} <b>FY${e(d.year)} ${e(String(d.field).replaceAll('_',' '))}</b> ${e(d.text.slice(0,200))} ${u?`<a href="${e(u)}" target="_blank" rel="noopener noreferrer">PDF ${e(d.pdfPage)}</a>`:''}</li>`;}).join('')}</ol>`:'<p class="t-dim">No reviewed fact matches. The assistant does not invent unsupported answers.</p>');break;}
    case 'ASK':{if(!arg){log('err','Usage: ASK how does WACC change the valuation?');break;}term.log.pop();log('ask','',``,{from:state.messages.length});term.focus='console';render();await ask(arg);return;}
    case 'MC':{if(!runtime.api){log('err','Monte Carlo runs in the Python service; it is unavailable in the static preview.');break;}
      const iterations=Math.round(number(arg)??1000);if(iterations<100||iterations>5000){log('err','Usage: MC 1000  (100–5000 simulations)');break;}
      const active=company.id;term.pending=true;log('info',`Monte Carlo · ${iterations} paths · seed 1729 · running in Python…`);render();
      try{const r=await api('/api/monte-carlo',{companyId:active,assumptions:clone(state.a),options:{iterations,growthSpread:.02,marginSpread:.01,waccSpread:.01}});if(company.id!==active)return;if(!r.valid)throw new Error((r.errors??['Invalid inputs']).join(' '));term.mc=r;log('ok',`MC P5 ${money(r.p5,2)} · P50 ${money(r.p50,2)} · P95 ${money(r.p95,2)} per share`,`<p class="t-dim">${e(r.warning??'')}</p>`);}
      catch(error){log('err',error.message);}finally{term.pending=false;}break;}
    case 'RDCF':{if(!runtime.api){log('err','Reverse DCF runs in the Python service; it is unavailable in the static preview.');break;}
      const price=number(arg);if(price===null||price<=0){log('err','Usage: RDCF 1500  (hypothetical INR price per share)');break;}
      const active=company.id;term.pending=true;log('info',`Reverse DCF at hypothetical ₹${n(price,2)} · solving in Python…`);render();
      try{const r=await api('/api/reverse-dcf',{companyId:active,assumptions:clone(state.a),price});if(company.id!==active)return;if(!r.valid)throw new Error((r.errors??['Invalid inputs']).join(' '));term.rdcf={...r,price};log('ok',`Implied flat 5-yr growth ${percent(r.impliedGrowth,2)} for ₹${n(price,2)} (hypothetical price, not a quote)`,`<p class="t-dim">${e(r.warning??'')}</p>`);}
      catch(error){log('err',error.message);}finally{term.pending=false;}break;}
    default:log('err',`Unknown command “${head}”. Type HELP.`);
  }
  render();
}

/* ---------- panels ---------- */
const panel=(id,code,title,body,extra='',cls='')=>`<section class="t-panel ${cls} ${term.focus===id?'t-focus':''}" id="t-${id}" aria-labelledby="t-${id}-title"><header class="t-panel-head"><span class="t-code">${code}</span><h2 id="t-${id}-title">${title}</h2><span class="t-panel-extra">${extra}</span></header><div class="t-panel-body">${body}</div></section>`;
const row=(label,value,cls='',kind='')=>`<div class="t-row"><span class="t-label">${label}</span><span class="t-val ${cls}">${value}${kind?' '+tag(kind):''}</span></div>`;

function desPanel(){
  const h=company.historical,last=h.at(-1),first=h[0],s=company.shares;
  return panel('des','DES',`${e(company.name)}`,`${row('Ticker',`NSE ${e(company.ticker)} · BSE ${e(company.scrip)}`)}${row('ISIN',e(company.isin))}${row('Sector',e(company.sector))}${row('Basis',`Consolidated Ind AS · ${e(company.unit)}`)}${row('Periods',`FY${first.year}–FY${last.year} · March year-end`)}${row('Net shares',`${n(s.netCrore,4)} Cr · ${dated(s.date)}`,'','fact')}${row('Treasury excluded',`${n(s.treasuryCrore,4)} Cr`,'','fact')}${row('Fully diluted',s.fullyDilutedCrore==null?'<span class="t-warn">Unresolved</span>':n(s.fullyDilutedCrore,4)+' Cr')}${row('PX LAST','<span class="t-warn">N/A</span>')}<p class="t-note">No reviewed same-date BSE close is on file, so market cap and upside stay unavailable. A provider quote or hypothetical price cannot substitute.</p>`,`<span class="t-dim">${e(company.ticker)} IN</span>`);
}

function faPanel(){
  const h=company.historical,an=state.r.analytics?.annuals??cases.base.analytics?.annuals??[];
  const lines=[['Revenue',x=>x.revenue,true],['Operating profit (pre-exc.)',x=>x.ebit,true],['Reported EBIT',x=>x.reportedEbit],['Owners’ profit',x=>x.netIncome,true],['D&A',x=>x.da],['Capex',x=>x.capex],['Operating cash flow',x=>x.cfo,true],['Investing cash flow',x=>x.cfi],['Financing cash flow',x=>x.cff],['Total assets',x=>x.assets],['Total equity',x=>x.equity],['Cash & equivalents',x=>x.cash],['Trade receivables',x=>x.receivables],['Trade payables',x=>x.payables]];
  const ratios=[['Operating margin','operating_margin'],['Revenue growth','revenue_growth'],['ROE','roe'],['ROA','roa'],['Diluted EPS ₹','diluted_eps',true]];
  return panel('fa','FA','Financial analysis',`<table class="t-table"><thead><tr><th>INR Cr ${tag('fact')}</th>${h.map(x=>`<th>FY${x.year}</th>`).join('')}<th>YoY</th></tr></thead><tbody>${lines.map(([label,fn,bold])=>{const a=fn(h.at(-2)),b=fn(h.at(-1)),yoy=typeof a==='number'&&typeof b==='number'&&a!==0?b/Math.abs(a)-(a<0?-1:1):null;return `<tr class="${bold?'t-strong':''}"><td>${label}</td>${h.map(x=>`<td class="${sign(fn(x))==='t-down'?'t-down':''}">${n(fn(x))}</td>`).join('')}<td class="${sign(yoy)}">${yoy===null?'—':arrow(yoy)+' '+pct(Math.abs(yoy))}</td></tr>`;}).join('')}<tr class="t-sep"><td colspan="${h.length+2}">Ratios ${tag('calc')}</td></tr>${ratios.map(([label,key,raw])=>`<tr><td>${label}</td>${h.map((_,i)=>{const v=an[i]?.[key];return `<td>${v==null?'—':raw?n(v,2):pct(v)}</td>`;}).join('')}<td></td></tr>`).join('')}</tbody></table>`,`<span class="t-dim">Consolidated · Ind AS</span>`);
}

function gpPanel(){
  const h=company.historical,f=state.r.forecast??[],k=term.chart;
  const series=k==='fcff'?f.map(x=>({label:`FY${String(x.year).slice(2)}E`,v:x.fcff,est:true,pv:x.pv})):[...h.map(x=>({label:`FY${String(x.year).slice(2)}`,v:x[k],est:false})),...(k==='cfo'?[]:f.map(x=>({label:`FY${String(x.year).slice(2)}E`,v:x[k],est:true})))];
  const W=560,H=210,P={l:56,r:12,t:14,b:26},vals=series.map(s=>s.v).filter(v=>Number.isFinite(v)),max=Math.max(1,...vals)*1.08,min=Math.min(0,...vals);
  const bw=(W-P.l-P.r)/Math.max(1,series.length),y=v=>P.t+(max-v)/(max-min||1)*(H-P.t-P.b);
  const ticks=[0,.25,.5,.75,1].map(t=>min+(max-min)*t);
  const svg=`<svg class="t-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t-gp-desc"><desc id="t-gp-desc">${e({revenue:'Revenue',ebit:'Operating profit',cfo:'Operating cash flow',fcff:'Free cash flow to the firm'}[k])} in INR crore: ${series.map(s=>`${s.label} ${n(s.v)}`).join(', ')}.</desc>${ticks.map(t=>`<line x1="${P.l}" x2="${W-P.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="t-grid"/><text x="${P.l-6}" y="${(y(t)+3).toFixed(1)}" class="t-axis" text-anchor="end">${n(t/1000,0)}k</text>`).join('')}${series.map((s,i)=>{const x=P.l+i*bw+bw*.18,w=bw*.64,top=y(Math.max(0,s.v)),hgt=Math.abs(y(s.v)-y(0));return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1,hgt).toFixed(1)}" class="${s.est?'t-bar-est':'t-bar'}"><title>${s.label}: ₹${n(s.v)} crore${s.est?' (forecast)':''}</title></rect><text x="${(x+w/2).toFixed(1)}" y="${H-8}" class="t-axis" text-anchor="middle">${s.label}</text>${s.pv!=null?`<circle cx="${(x+w/2).toFixed(1)}" cy="${y(s.pv).toFixed(1)}" r="3" class="t-dot"/>`:''}`;}).join('')}${series.length>1?`<polyline class="t-line" points="${series.map((s,i)=>`${(P.l+i*bw+bw/2).toFixed(1)},${y(s.v).toFixed(1)}`).join(' ')}"/>`:''}</svg>`;
  const tabs=[['revenue','REV'],['ebit','EBIT'],['cfo','CFO'],['fcff','FCFF']].map(([id,label])=>`<button class="t-tab ${k===id?'active':''}" data-tchart="${id}" aria-pressed="${k===id}">${label}</button>`).join('');
  return panel('gp','GP','Graph',`${svg}<div class="t-legend"><span><i class="t-sw-fact"></i>Reported ${tag('fact')}</span>${k==='cfo'?'':`<span><i class="t-sw-est"></i>Forecast ${tag('calc')}</span>`}${k==='fcff'?`<span><i class="t-sw-dot"></i>Present value</span>`:''}<span class="t-dim">INR crore · thousands on axis</span></div>`,tabs);
}

function dcfPanel(){
  const r=state.r,a=state.a,scen=state.scenario.toUpperCase();
  const bridge=(r.bridge??[]).map(b=>row(e(b.label),`${b.total?'':b.value>=0?'+':'−'}${money(Math.abs(b.value))} Cr`,b.total?'t-strong':b.value<0?'t-down':'t-up',b.total?'calc':b.label.match(/cash|debt|lease|non-controlling|nci|minority/i)?'asm':'calc')).join('');
  return panel('dcf','DCF',`FCFF valuation · ${scen}`,`<div class="t-big"><span class="t-big-label">Value / share ${tag('calc')}</span><strong>${money(r.perShare,2)}</strong><span class="t-big-sub">${e(r.status??'')} · ${e(r.calculationAuthority??'python')}</span></div>${row('Enterprise value',money(r.enterpriseValue)+' Cr','','calc')}${row('PV forecast FCFF',money(r.forecastPV)+' Cr')}${row('PV terminal value',money(r.terminalPV)+' Cr')}${row('Terminal share of EV',pct(r.terminalContribution),r.terminalContribution>.75?'t-warn':'')}${row('Equity value',money(r.equityValue)+' Cr','t-strong','calc')}${row('Shares (net)',n(r.shares,4)+' Cr','','fact')}${row('Market price',r.market?money(r.market.price,2):'<span class="t-warn">N/A</span>')}${row('Upside',r.upside==null?'<span class="t-dim">Needs reviewed BSE close</span>':`<span class="${sign(r.upside)}">${arrow(r.upside)} ${pct(Math.abs(r.upside))}</span>`)}<div class="t-sub-head">Equity bridge</div>${bridge}<div class="t-sub-head">Key inputs ${tag('asm')}</div><div class="t-chips">${[['WACC',pct(a.wacc)],['g∞',pct(a.terminalGrowth)],['Margin',pct(a.margin)],['Tax',pct(a.tax)],['Eff. date',e(a.valuationDate)]].map(([l,v])=>`<span><b>${l}</b> ${v}</span>`).join('')}</div>`,`<span class="t-scen t-scen-${e(state.scenario)}">${scen}</span>`);
}

function fcffPanel(){
  const f=state.r.forecast??[];const rows=[['Revenue','revenue',true],['Growth',null],['EBIT','ebit'],['NOPAT','nopat'],['+ D&A','da'],['− Capex','capex'],['− ΔNWC','deltaNwc'],['FCFF','fcff',true],['Discount factor','discountFactor'],['PV of FCFF','pv',true]];
  const growth=state.a.growth??[];
  return panel('fcff','FCFF','Forecast · free cash flow to the firm',`<table class="t-table"><thead><tr><th>INR Cr ${tag('calc')}</th>${f.map(x=>`<th>FY${x.year}E</th>`).join('')}</tr></thead><tbody>${rows.map(([label,key,bold])=>`<tr class="${bold?'t-strong':''}"><td>${label}${key===null?' '+tag('asm'):''}</td>${f.map((x,i)=>`<td>${key===null?pct(growth[i]):key==='discountFactor'?n(x[key],4):n(x[key])}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="t-note">FCFF = EBIT × (1 − tax) + D&A − capex − ΔNWC. Discount periods use elapsed days ÷ 365.25 from ${e(state.a.valuationDate)}. Terminal value requires WACC &gt; g.</p>`);
}

function sensPanel(){
  const s=state.r.sensitivity;if(!s)return panel('sens','SENS','Sensitivity','<p class="t-dim">Unavailable for this result.</p>');
  const base=s.values[2]?.[2],vals=s.values.flat().filter(v=>v!==null),spread=Math.max(1,...vals.map(v=>Math.abs(v-base)));
  return panel('sens','SENS','Value / share · WACC × g∞',`<table class="t-heat"><thead><tr><th>WACC↓ g→</th>${s.growth.map(g=>`<th>${pct(g)}</th>`).join('')}</tr></thead><tbody>${s.wacc.map((w,i)=>`<tr><th>${pct(w)}</th>${s.values[i].map((v,j)=>{if(v===null)return '<td class="t-na">n/a</td>';const d=(v-base)/spread,alpha=(.12+Math.abs(d)*.5).toFixed(2);return `<td class="${i===2&&j===2?'t-base':''}" style="background:${d>=0?`rgba(34,197,94,${alpha})`:`rgba(239,68,68,${alpha})`}">${n(v,0)}</td>`;}).join('')}</tr>`).join('')}</tbody></table><p class="t-note">${tag('calc')} INR per share. Outlined cell = active scenario. Each cell rebuilds terminal reinvestment in Python.</p>`);
}

function compPanel(){
  const rows=state.r.peerComparison??cases.base.peerComparison??[];const best=Math.max(...rows.map(p=>p.ebitMargin??0));
  return panel('comp','COMP','Peer comparison',`<table class="t-table"><thead><tr><th>Issuer</th><th>FY</th><th>Revenue ${tag('fact')}</th><th>EBIT m.</th><th>Net m.</th><th>P/E</th><th>EV/EBIT</th></tr></thead><tbody>${rows.map(p=>`<tr class="${p.id===company.id?'t-subject':''}"><td title="${e(p.name)}">${e(p.id===company.id?company.ticker:String(p.id).toUpperCase())}</td><td>${e(p.year)}</td><td>${n(p.revenue)}</td><td class="${p.ebitMargin===best?'t-up':''}">${pct(p.ebitMargin)}</td><td>${pct(p.netMargin)}</td><td>${p.pe==null?'—':n(p.pe,1)+'×'}</td><td>${p.evEbit==null?'—':n(p.evEbit,1)+'×'}</td></tr>`).join('')}</tbody></table><div class="t-bars">${rows.map(p=>`<div class="t-barrow"><span>${e(p.id===company.id?company.ticker:String(p.id).toUpperCase())}</span><i style="width:${Math.max(2,Math.min(100,(p.ebitMargin??0)/.3*100)).toFixed(1)}%" class="${p.id===company.id?'t-subject-bar':''}"></i><b>${pct(p.ebitMargin)}</b></div>`).join('')}</div><p class="t-note">Reported-basis FY figures. Multiples stay “—” until compatible, reviewed prices and share denominators are imported.</p>`);
}

function chkPanel(){
  const checks=state.r.reconciliations??[],pass=checks.filter(c=>c.status==='pass').length,years=[...new Set(checks.map(c=>c.year))],labels=[...new Set(checks.map(c=>c.label))],warnings=state.r.warnings??[];
  const cell=(y,l)=>{const c=checks.find(x=>x.year===y&&x.label===l);return c?`<td class="${c.status==='pass'?'t-up':'t-down'}" title="Residual ${e(c.residual)} crore">${c.status==='pass'?'✓ PASS':'✗ FAIL'}</td>`:'<td class="t-dim">—</td>';};
  return panel('chk','CHK','Data checks',`<div class="t-big t-big-small"><strong class="${pass===checks.length&&checks.length?'t-up':'t-down'}">${pass}/${checks.length}</strong><span class="t-big-sub">reconciliations pass · ±₹1 Cr tolerance</span></div><table class="t-table"><thead><tr><th>Identity</th>${years.map(y=>`<th>FY${e(y)}</th>`).join('')}</tr></thead><tbody>${labels.map(l=>`<tr><td>${e(l)}</td>${years.map(y=>cell(y,l)).join('')}</tr>`).join('')}</tbody></table>${warnings.length?`<details class="t-details"><summary>${warnings.length} model warning${warnings.length===1?'':'s'} travel with this valuation</summary>${warnings.map(w=>`<p class="t-warnline">⚠ ${e(w)}</p>`).join('')}</details>`:''}`);
}

function evidPanel(){
  const facts=(company.facts??[]).filter(f=>f.year===company.historical.at(-1).year).slice(0,8);
  return panel('evid','EVID','Evidence & lineage',`<table class="t-table t-compact"><thead><tr><th>Source</th><th>Published</th><th>Pages</th><th></th></tr></thead><tbody>${company.sources.map(s=>{const u=safeUrl(s.url);return `<tr><td>${e(s.title)}</td><td>${e(s.publicationDate)}</td><td>${e(s.pages)}</td><td>${u?`<a href="${e(u)}" target="_blank" rel="noopener noreferrer" aria-label="Open source document ${e(s.title)}">OPEN ↗</a>`:''}</td></tr>`;}).join('')}</tbody></table><div class="t-sub-head">FY${company.historical.at(-1).year} facts · page-linked ${tag('fact')}</div><table class="t-table t-compact"><tbody>${facts.map(f=>{const u=safeUrl(f.sourceUrl);return `<tr><td>${e(f.field.replaceAll('_',' '))}</td><td>${n(f.value)} ${e(f.unit)}</td><td>${u?`<a href="${e(u)}#page=${e(f.pdfPage)}" target="_blank" rel="noopener noreferrer">PDF p.${e(f.pdfPage)}</a>`:'p.'+e(f.pdfPage)}</td></tr>`;}).join('')}</tbody></table><p class="t-note">Input manifest SHA-256 ${e(String(company.inputManifest?.sha256??'—').slice(0,16))}… identifies the inputs, not their correctness.</p>`);
}

function asmPanel(){
  const a=state.a,fy=company.historical.at(-1).year;
  const field=(key,label,value,attrs='')=>`<label class="t-field"><span>${label}</span><input data-tasm="${key}" type="number" step="0.1" value="${typeof value==='number'?Number((value*100).toFixed(4)):''}" ${runtime.api?'':'disabled'} ${attrs}><em>%</em></label>`;
  return panel('asm','ASM','Assumptions',`<div class="t-fields">${a.growth.map((g,i)=>field('growth'+i,`Growth FY${fy+1+i}E`,g)).join('')}${field('margin','EBIT margin',a.margin)}${field('tax','Operating tax',a.tax)}${field('wacc','WACC',a.wacc)}${field('terminalGrowth','Terminal g',a.terminalGrowth)}${field('daRatio','D&A / rev',a.daRatio)}${field('capexRatio','Capex / rev',a.capexRatio)}${field('nwcRatio','NWC / rev',a.nwcRatio)}</div><div class="t-row-actions"><button class="t-btn" data-tcmd="BASE">BASE</button><button class="t-btn" data-tcmd="BULL">BULL</button><button class="t-btn" data-tcmd="BEAR">BEAR</button><button class="t-btn" data-tcmd="ASM">FULL EDITOR</button></div><p class="t-note">${tag('asm')} Educational defaults, not forecasts. ${runtime.api?'Press Enter in a field to recalculate in Python.':'Static preview: only compiled cases are available.'}</p>`,`<span class="t-scen t-scen-${e(state.scenario)}">${e(state.scenario.toUpperCase())}</span>`);
}

function consolePanel(){
  const message=m=>m.role==='user'?`<div class="t-log t-log-cmd"><span class="t-time">ASK</span><div>${e(m.text)}</div></div>`:`<div class="t-log t-log-answer"><span class="t-time">${m.answer.mode==='llm'?'AI':'EVD'}</span><div><b>${e(m.answer.title)}</b> ${tag('interp')}<p>${e(m.answer.body)}</p>${(m.answer.citations??[]).map(s=>{const u=safeUrl(s.url);return u?`<a href="${e(u)}" target="_blank" rel="noopener noreferrer">[${e(s.id)}]</a>`:'';}).join(' ')}${m.answer.notice?`<p class="t-dim">${e(m.answer.notice)}</p>`:''}</div></div>`;
  const entries=term.log.map(l=>l.kind==='ask'?state.messages.slice(l.from,l.from+2).map(message).join(''):`<div class="t-log t-log-${l.kind}"><span class="t-time">${e(l.time)}</span><div><span class="t-logtext">${e(l.text)}</span>${l.html}</div></div>`).join('');
  const chat=state.messages.length&&!term.log.some(l=>l.kind==='ask')?state.messages.map(message).join(''):'';
  const mc=term.mc?`<div class="t-mc">${[['P5',term.mc.p5],['P50',term.mc.p50],['P95',term.mc.p95]].map(([l,v])=>`<span><b>${l}</b>${money(v,0)}</span>`).join('')}<span class="t-dim">${n(term.mc.iterations)} paths · scenario percentiles, not return probabilities</span></div>`:'';
  return panel('console','CON','Console · research assistant',`${mc}<div class="t-console" id="t-console" role="log" aria-live="polite">${entries}${chat}${state.asking||term.pending?'<div class="t-log t-log-info"><span class="t-time">…</span><div class="t-blink">Working</div></div>':''}${!entries&&!chat?`<p class="t-dim">Type <b>HELP</b> for commands, <b>ASK</b> a question, or try <b>WACC 11</b>, <b>GP FCFF</b>, <b>MC 2000</b>, <b>SRCH FY2026 revenue</b>, <b>LOAD TCS</b>.</p>`:''}</div>`,`<span class="t-dim">${state.assistantMode==='optional_llm'?'LLM + citation checks':'Evidence mode'}</span>`);
}

/** Render the full-screen terminal workspace. */
export function terminalView(){
  const r=state.r,valid=r?.valid,a=state.a,last=company.historical.at(-1);
  const tape=[[`${company.ticker} DCF/SH`,money(r.perShare,2),'calc'],['EV',money(r.enterpriseValue)+' Cr','calc'],['EQUITY',money(r.equityValue)+' Cr','calc'],['WACC',pct(a.wacc),'asm'],['g∞',pct(a.terminalGrowth),'asm'],['TV/EV',pct(r.terminalContribution),'calc'],[`FY${String(last.year).slice(2)} REV`,money(last.revenue)+' Cr','fact'],[`FY${String(last.year).slice(2)} CFO`,money(last.cfo)+' Cr','fact'],['CHECKS',`${(r.reconciliations??[]).filter(c=>c.status==='pass').length}/${(r.reconciliations??[]).length}`,'calc'],['PX LAST','N/A','']];
  const body=!valid?`<div class="t-error" role="alert"><b>VALUATION PAUSED</b>${(r.errors??['Check the model inputs.']).map(x=>`<p>${e(x)}</p>`).join('')}<p>Type <b>BASE</b> to restore defaults.</p></div>${consolePanel()}`:`<div class="t-cols"><div class="t-col">${dcfPanel()}${asmPanel()}${sensPanel()}${desPanel()}</div><div class="t-col">${gpPanel()}${faPanel()}${fcffPanel()}${evidPanel()}</div><div class="t-col">${consolePanel()}${compPanel()}${chkPanel()}</div></div>`;
  return `<div class="term" data-busy="${state.busy}"><h1 class="sr-only">Artha Terminal · ${e(company.name)}</h1>
<div class="t-sticky"><header class="t-top"><span class="t-brand">ARTHA<b>▸</b>TERMINAL</span><span class="t-sec"><b>${e(company.ticker)} IN</b> Equity</span><span class="t-name">${e(company.name)}</span><span class="t-ids">NSE ${e(company.ticker)} · BSE ${e(company.scrip)} · ${e(company.isin)}</span><label class="sr-only" for="t-company">Company</label><select id="t-company" class="t-select">${dataset.companies.map(c=>`<option value="${e(c.id)}" ${c.id===company.id?'selected':''}>${e(c.ticker)}</option>`).join('')}</select><span class="t-status ${state.error?'t-down':state.busy||term.pending?'t-warn':'t-up'}" title="${runtime.api?'Python calculation service':'Static preview'}">● ${state.error?'ERROR':state.busy||term.pending?'CALC':runtime.api?'PY LIVE':'PREVIEW'}</span><span class="t-clock" id="t-clock" aria-label="India Standard Time">${istTime()}</span><button class="t-btn t-exit" data-tcmd="EXIT" title="Return to the standard workspace">EXIT</button></header>
<form class="t-cmdbar" id="t-form" autocomplete="off"><label for="t-cmd" class="t-prompt">${e(company.ticker)}&gt;</label><input id="t-cmd" class="t-cmd" value="${e(term.input)}" spellcheck="false" autocapitalize="characters" aria-describedby="t-hint" placeholder="Type a command · HELP"><button class="t-go" type="submit">GO</button><span id="t-hint" class="sr-only">Enter a terminal command such as HELP, DCF or WACC 11. Use up and down arrows for history.</span><nav class="t-fkeys" aria-label="Function keys">${FKEYS.map(([k,c])=>`<button type="button" class="t-fkey" data-tcmd="${c}"><b>${k}</b>${c}</button>`).join('')}</nav></form>
<div class="t-tape" aria-label="Key figures">${tape.map(([l,v,k])=>`<span class="t-tape-item"><b>${l}</b> ${v}${k?' '+tag(k):''}</span>`).join('')}</div></div>
${state.error?`<div class="t-error" role="alert"><b>SERVICE</b> ${e(state.error)} <button class="t-btn" data-taction="retry">RETRY</button></div>`:''}
<main id="main" class="t-main" tabindex="-1" aria-busy="${state.busy}">${body}</main>
<footer class="t-foot"><span>${tag('fact')} reported ${tag('asm')} assumption ${tag('calc')} Python calculation ${tag('interp')} interpretation</span><span>Snapshot ${e(dataset.asOf)} · INR crore unless stated · Educational research, not investment advice</span></footer></div>`;
}

function istTime(suffix=true){try{return new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour12:false})+(suffix?' IST':'');}catch{return '';}}
let clock=null;
/** Bind terminal controls after each render and restore keyboard focus. */
export function bindTerminal(previousFocus){
  const input=$('#t-cmd'),form=$('#t-form');
  if(!input||!form)return;
  form.addEventListener('submit',ev=>{ev.preventDefault();runCommand(input.value);});
  input.addEventListener('input',()=>{term.input=input.value;});
  input.addEventListener('keydown',ev=>{
    if(ev.key==='ArrowUp'||ev.key==='ArrowDown'){ev.preventDefault();if(!term.history.length)return;term.cursor=Math.max(-1,Math.min(term.history.length-1,term.cursor+(ev.key==='ArrowUp'?1:-1)));input.value=term.cursor<0?'':term.history[term.cursor];term.input=input.value;}
    else if(ev.key==='Tab'&&input.value.trim()){const p=input.value.trim().toUpperCase(),hit=COMMANDS.find(([c])=>c.startsWith(p));if(hit){ev.preventDefault();input.value=hit[0]+' ';term.input=input.value;}}
    else if(ev.key==='Escape'){input.value='';term.input='';}
  });
  document.querySelectorAll('[data-tcmd]').forEach(b=>b.onclick=()=>runCommand(b.dataset.tcmd));
  document.querySelectorAll('[data-tchart]').forEach(b=>b.onclick=()=>{term.chart=b.dataset.tchart;render();});
  document.querySelectorAll('[data-taction]').forEach(b=>b.onclick=()=>actions.handle?.(b.dataset.taction));
  document.querySelectorAll('[data-tasm]').forEach(f=>f.addEventListener('keydown',ev=>{if(ev.key!=='Enter')return;ev.preventDefault();const key=f.dataset.tasm,v=Number(f.value);if(!Number.isFinite(v)){toast('Enter a number.');return;}
    if(key.startsWith('growth')){const i=Number(key.slice(6)),g=state.a.growth.map(x=>Number((x*100).toFixed(4)));g[i]=v;runCommand('GROW '+g.join(' '));}
    else runCommand(`${FIELD_COMMAND[key]} ${v}`);}));
  const select=$('#t-company');if(select)select.onchange=ev=>{actions.selectCompany?.(ev.target.value);};
  const con=$('#t-console');if(con)con.scrollTop=con.scrollHeight;
  const head=$('.t-sticky');if(head?.offsetHeight&&document.documentElement.style?.setProperty)document.documentElement.style.setProperty('--t-head-h',(head.offsetHeight+8)+'px');
  const restore=previousFocus&&previousFocus!=='t-cmd'?$('#'+previousFocus):null;
  (restore??input).focus?.({preventScroll:true});
  if(term.focus&&term.scroll){term.scroll=false;$('#t-'+term.focus)?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
  if(!clock&&typeof window.requestAnimationFrame==='function')clock=setInterval(()=>{const c=$('#t-clock');if(c)c.textContent=istTime();},1000);
}

function render(){actions.render?.();}

/** Keyboard function keys (F5 is left to the browser). */
export function terminalKey(ev){
  if(state.view!=='terminal')return false;
  const hit=FKEYS.find(([k])=>k===ev.key);
  if(hit){ev.preventDefault();runCommand(hit[1]);return true;}
  return false;
}
