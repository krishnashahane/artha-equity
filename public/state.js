import dataset from './data.js';
import runtime from './runtime.js';
import {clone} from './engine.js';

/** @param {string} s CSS selector. @returns {HTMLElement|null} */
const $=s=>document.querySelector(s);
/** Only https links are rendered; anything else (javascript:, data:) becomes inert. */
const safeUrl=u=>{try{const x=new URL(String(u));return x.protocol==='https:'?x.href:'#';}catch{return '#';}};
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v):'—';
const money=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?'₹'+n(v,d):'—';
const percent=(v,d=1)=>typeof v==='number'&&Number.isFinite(v)?n(v*100,d)+'%':'—';
const dated=value=>new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const paths={search:'m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',arrow:'M4 12h16 m-6-6 6 6-6 6',up:'m6 15 6-6 6 6',down:'m6 9 6 6 6-6',external:'M14 3h7v7 m0-7-11 11 M10 3H4v17h17v-6',close:'m6 6 12 12 M6 18 18 6',file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 12h8 M8 16h6',download:'M12 3v12 m-5-5 5 5 5-5 M5 16v5h14v-5',check:'m5 12 4 4L19 6',info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',save:'M6 3h12v18l-6-4-6 4z',sliders:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',send:'M12 20V4 m-6 6 6-6 6 6',trash:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',code:'m8 6-6 6 6 6 m8-12 6 6-6 6 m-3-15-2 18',shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z m-4 9 3 3 5-6',upload:'M12 17V3 m-5 5 5-5 5 5 M4 16v5h16v-5'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]??paths.file}"/></svg>`;
function read(key,fallback){try{const x=JSON.parse(localStorage.getItem('artha.'+key));return x??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem('artha.'+key,JSON.stringify(value));}catch{toast('Local storage is unavailable. Export a copy of your work.');}}
let company=dataset.companies.find(c=>c.id===read('companyId',null))??dataset.companies[0];
const peers=clone(dataset.peers),compiled=dataset.precomputed;
let cases=compiled.cases[company.id];
/** @typedef {{growth:number[], margins?:number[], margin:number, wacc:number, terminalGrowth:number, [key:string]:any}} Assumptions */
/** @typedef {{valid:boolean, perShare?:number, forecast?:Object[], [key:string]:any}} ValuationResult */
/** Shared UI state; all financial results originate in Python. */
const state={requestId:0,modalReturn:null,view:['company','valuation','research','terminal'].includes(location.hash.slice(1))?location.hash.slice(1):'company',scenario:'base',a:clone(cases.base.assumptions),r:clone(cases.base),chart:'revenue',subview:'model',fullForecast:false,statement:'income',statementsOpen:false,messages:[],asking:false,busy:false,error:null,assistantMode:'evidence',market:read('market',{}),scenarios:read('scenarios',[]),audit:read('audit',[])};
let toastTimer;
const button=(label,action,style='',ico='')=>`<button class="btn ${style}" data-action="${action}">${ico?icon(ico):''}${e(label)}</button>`;
const linkButton=(label,action,ico='arrow')=>button(label,action,'btn-quiet',ico);
function event(action,detail){state.audit.unshift({action,detail,time:new Date().toISOString()});state.audit=state.audit.slice(0,100);write('audit',state.audit);}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}

/** Switch only to a registered company with Python-compiled preview cases.
 * @param {string} id
 * @returns {boolean}
 */
function setCompany(id){const next=dataset.companies.find(c=>c.id===id);if(!next)return false;company=next;cases=compiled.cases[id];return true;}

export {safeUrl,$,e,n,money,percent,dated,paths,icon,company,peers,cases,state,toastTimer,button,linkButton,runtime,dataset,clone,read,write,event,toast,setCompany,compiled};
