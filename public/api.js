/** Native ES module; no build-time dependency or financial calculation authority. */
import {$,e,n,money,percent,dated,paths,icon,company,peers,cases,state,toastTimer,button,linkButton,runtime,dataset,clone,read,write,event,toast,setCompany,compiled} from './state.js';
import {render} from './views.js';
import {retrieveEvidence} from './retrieval.js';

/** Send a same-origin JSON request; validation errors remain structured.
 * @param {string} route
 * @param {Object} [body]
 * @returns {Promise<Object>}
 */
export async function api(route,body){const response=await fetch(route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const value=await response.json();if(!response.ok&&!Array.isArray(value.errors))throw new Error(value.error??'The research service is unavailable.');return value;}

/** Fetch a Python valuation; discard stale responses after company or input changes.
 * @param {boolean} [persist=false] Save an immutable server snapshot.
 * @returns {Promise<void>}
 */
export async function refresh(persist=false){if(!runtime.api)return;const id=++state.requestId;state.busy=true;state.error=null;render();try{const r=await api('/api/valuation',{companyId:company.id,assumptions:state.a,persist,marketOverrides:state.market});if(id!==state.requestId)return;state.r=r;}catch(error){if(id!==state.requestId)return;state.error=error.message;}finally{if(id===state.requestId){state.busy=false;render();}}}

/** offlineTopic UI helper. */
export function offlineTopic(question){const q=question.toLowerCase();if(/wacc|discount|terminal|cost of capital/.test(q))return 'discount';if(/cash|debt|bridge|share|treasury|dilut/.test(q))return 'bridge';if(/peer|compar|multiple/.test(q))return 'peers';if(/risk|limitation|buy|sell|invest|trust/.test(q))return 'risks';if(/source|report|data|audit/.test(q))return 'sources';if(/revenue|sales|growth|performance|profit|margin/.test(q))return 'growth';if(/value|valuation|fcff|dcf|explain/.test(q))return 'valuation';return null;}

/** ask UI helper. */
export async function ask(question){question=String(question).trim().slice(0,2000);if(!question||state.asking||state.busy)return;const activeCompany=company.id,conversation=state.messages;state.messages.push({role:'user',text:question});state.asking=true;render();try{let answer;if(runtime.api)answer=await api('/api/assistant',{companyId:company.id,question,assumptions:state.a,marketOverrides:state.market});else{const topic=offlineTopic(question);answer=topic?clone(compiled.answers[company.id][state.scenario==='custom'?'base':state.scenario][topic]):{title:'Research coverage',body:'This workspace can explain the loaded financial history, valuation, assumptions, shares, peer coverage and limitations. It does not browse or invent an answer outside those sources.',citations:[],mode:'evidence'};answer.retrieval=retrieveEvidence(question,company,peers);}if(company.id!==activeCompany||state.messages!==conversation)return;if(!answer.title||!answer.body||!Array.isArray(answer.citations))throw new Error('The explanation service returned an invalid response.');state.messages.push({role:'assistant',answer});}catch(error){if(company.id!==activeCompany||state.messages!==conversation)return;state.messages.push({role:'assistant',answer:{title:'The research service needs a moment.',body:error.message,citations:[],mode:'evidence'}});}finally{if(company.id!==activeCompany||state.messages!==conversation)return;state.asking=false;render();$('#question')?.focus({preventScroll:true});$('#question-form')?.scrollIntoView({block:'nearest',behavior:'smooth'});}}
