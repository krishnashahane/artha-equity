/** Native ES module; no build-time dependency or financial calculation authority. */
import {$,e,n,money,percent,dated,paths,icon,company,peers,cases,state,toastTimer,button,linkButton,runtime,dataset,clone,read,write,event,toast,setCompany,compiled} from './state.js';
import {api,refresh,ask} from './api.js';
import {render} from './views.js';
import {closeDialog,csv,exportCsv,exportDialog,evidenceDialog,reviewDialog,assumptionsDialog,saveDialog,savedDialog,searchDialog,marketDialog,studyDialog} from './dialogs.js';
import {trapFocus} from './focus.js';
import {connectTerminal,terminalKey} from './terminal.js';

/** go UI helper. */
export function go(view){state.view=view;location.hash=view;closeDialog();render();window.scrollTo({top:0,behavior:'instant'});}

/** chooseCase UI helper. */
export function chooseCase(name){state.scenario=name;state.a=clone(cases[name].assumptions);event('Scenario selected',name+' case');if(runtime.api)refresh();else{state.r=clone(cases[name]);render();}}

/** Load a registered issuer and invalidate pending requests. @param {string} id */
export function selectCompany(id){
  if(!setCompany(id))return;
  ++state.requestId;write('companyId',id);
  state.a=clone(cases.base.assumptions);state.r=clone(cases.base);state.scenario='base';
  state.messages=[];state.error=null;state.busy=false;state.asking=false;
  closeDialog();render();if(runtime.api)refresh();
}

/** handle UI helper. */
export function handle(action){const handlers={theme:()=>{const dark=window.matchMedia('(prefers-color-scheme: dark)').matches;const current=document.documentElement.dataset.theme??(dark?'dark':'light');const next=current==='dark'?'light':'dark';document.documentElement.dataset.theme=next;write('theme',next);toast(next==='dark'?'Dark appearance enabled.':'Light appearance enabled.');},'monte-carlo':()=>studyDialog('monte-carlo'),'reverse-dcf':()=>studyDialog('reverse-dcf'),company:()=>go('company'),valuation:()=>go('valuation'),research:()=>go('research'),peers:()=>{state.subview='peers';go('valuation');},export:exportDialog,csv:exportCsv,evidence:()=>evidenceDialog(),checks:()=>evidenceDialog('checks'),method:()=>evidenceDialog('method'),review:reviewDialog,assumptions:assumptionsDialog,save:saveDialog,saved:savedDialog,search:searchDialog,market:marketDialog,retry:()=>refresh(),'forecast-detail':()=>{state.fullForecast=!state.fullForecast;render();},'new-chat':()=>{state.messages=[];state.asking=false;render();}};handlers[action]?.();}

/** bind UI helper. */
export function bind(){$('#company-select').onchange=ev=>selectCompany(ev.target.value);document.querySelectorAll('.nav-link,.wordmark').forEach(a=>a.onclick=ev=>{ev.preventDefault();go(a.hash.slice(1));});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>handle(b.dataset.action));document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>chooseCase(b.dataset.case));document.querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>{state.chart=b.dataset.chart;render();});document.querySelectorAll('[data-statement]').forEach(b=>b.onclick=()=>{state.statement=b.dataset.statement;state.statementsOpen=true;render();});document.querySelectorAll('[data-remember]').forEach(d=>d.ontoggle=()=>{state[d.dataset.remember]=d.open;});document.querySelectorAll('[data-subview]').forEach(b=>b.onclick=()=>{state.subview=b.dataset.subview;render();});document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>ask(b.dataset.question));$('#question-form')?.addEventListener('submit',ev=>{ev.preventDefault();ask($('#question').value);});$('#question')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();ask(ev.target.value);}});}

window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(['company','valuation','research','terminal'].includes(view)&&view!==state.view){state.view=view;closeDialog();render();window.scrollTo({top:0,behavior:'instant'});}});
document.addEventListener('keydown',ev=>{if(terminalKey(ev))return;if(ev.key==='Escape')closeDialog();if(ev.key==='`'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('.modal')){ev.preventDefault();go(state.view==='terminal'?'company':'terminal');return;}if(state.view!=='terminal'&&ev.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){ev.preventDefault();searchDialog();}trapFocus(ev,$('.modal'),document.activeElement);});
const savedTheme=read('theme',null);if(['dark','light'].includes(savedTheme))document.documentElement.dataset.theme=savedTheme;
connectTerminal({go,chooseCase,selectCompany,handle,render});
render();
if(runtime.api){refresh();api('/api/health').then(data=>{state.assistantMode=data.assistantMode;}).catch(()=>{});}

