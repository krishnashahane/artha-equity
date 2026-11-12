/** Shared numerical model: browser, HTTP API and Node CLI import this exact file. */
import {retrieveEvidence} from './retrieval.js';
export const MODEL_VERSION = '1.1.0';
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const isoDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
export function validDirectMarket(m) {
  if(!m||m.method!=='direct_bse_close'||!m.reviewed||!finite(m.price)||m.price<=0||!isoDate(m.date)||!/^[a-f0-9]{64}$/i.test(m.sourceFileSha256??''))return false;
  try{const url=new URL(m.sourceUrl);return url.protocol==='https:'&&(url.hostname==='bseindia.com'||url.hostname.endsWith('.bseindia.com'))&&typeof m.sourceArtifact==='string'&&m.sourceArtifact.includes(m.date.replaceAll('-',''));}catch{return false;}
}
export const clone = (x) => JSON.parse(JSON.stringify(x));
export function validateCompany(company) {
  const errors=[];
  if(!company || typeof company!=='object') return ['Company input must be an object.'];
  if(!/^[a-z][a-z0-9_]{0,40}$/.test(company.id??'')) errors.push('Company ID must use lowercase snake_case.');
  if(typeof company.name!=='string'||!company.name.trim()||company.name.length>200)errors.push('A company name of 1–200 characters is required.');
  if(company.currency!=='INR' || company.unit!=='INR crore') errors.push('The model requires INR crore financial data.');
  if(!Array.isArray(company.historical)||company.historical.length<3) errors.push('At least three annual observations are required.');
  else {
    const years=company.historical.map(h=>h.year);
    if(years.some((y,i)=>!Number.isInteger(y)||(i&&y!==years[i-1]+1))) errors.push('Historical years must be consecutive and ascending.');
    const required=['revenue','ebit','netIncome','da','capex','receivables','payables','cash','assets','equity','liabilities','cfo','cfi','cff','netCashChange','fx','openingCash','closingCash'];
    if(company.historical.some(h=>required.some(k=>!finite(h[k])))) errors.push('Historical statement fields must be finite numbers.');
    if(company.historical.some(h=>h.revenue<=0)) errors.push('Historical revenue must be positive.');
  }
  if(!Array.isArray(company.sources)||!company.sources.length) errors.push('Source documents are required.');
  else for(const s of company.sources) {
    let safe=false;try{safe=new URL(s.url).protocol==='https:';}catch{}
    if(!safe||!s.id||!s.title||!s.pages||!isoDate(s.publicationDate)) errors.push('Each source needs an ID, HTTPS URL, title, page reference and publication date.');
  }
  if(company.facts!==undefined&&!Array.isArray(company.facts))errors.push('Source facts must be an array.');
  if(!company.shares||!finite(company.shares.netCrore)||company.shares.netCrore<=0) errors.push('A positive net share count is required.');
  else if(company.shares.fullyDilutedCrore!==null && company.shares.fullyDilutedCrore!==undefined && (!finite(company.shares.fullyDilutedCrore)||company.shares.fullyDilutedCrore<company.shares.netCrore)) errors.push('Fully diluted shares cannot be below net shares.');
  if(company.shares&&!isoDate(company.shares.date))errors.push('Share observations require a valid ISO effective date.');
  return errors;
}
export function defaults(company, scenario = 'base') {
  const a = clone(company.assumptions);
  if (scenario === 'bull') {
    a.growth = a.growth.map((x) => x + .02);
    a.margin += .015;
    a.wacc = Math.max(.05, a.wacc - .01);
  }
  if (scenario === 'bear') {
    a.growth = a.growth.map((x) => Math.max(-.8, x - .03));
    a.margin -= .02;
    a.wacc += .015;
  }
  return a;
}
export function validateAssumptions(a) {
  const errors = [];
  for (const key of ['wacc','terminalGrowth','margin','tax','daRatio','capexRatio','nwcRatio','excessCash','debt','leases','nci']) {
    if (!finite(a[key])) errors.push(`${key} must be a finite number.`);
  }
  if (!Array.isArray(a.growth) || a.growth.length !== 5 || a.growth.some(x => !finite(x) || x <= -1)) errors.push('Five finite growth assumptions above −100% are required.');
  if (errors.length) return errors;
  if (a.wacc <= 0 || a.wacc >= 1) errors.push('WACC must be between 0% and 100%.');
  if (a.terminalGrowth <= -1 || a.terminalGrowth >= a.wacc) errors.push('Terminal growth must be below WACC and above −100%.');
  if (a.margin < -1 || a.margin > 1) errors.push('Operating margin must be between −100% and 100%.');
  if (a.tax < 0 || a.tax > 1) errors.push('Tax rate must be between 0% and 100%.');
  for (const key of ['daRatio','capexRatio','excessCash','debt','leases','nci']) if (a[key] < 0) errors.push(`${key} cannot be negative.`);
  if (!isoDate(a.valuationDate)) errors.push('A valid ISO valuation date is required.');
  if (!isoDate(a.informationCutoff)) errors.push('A valid ISO information cutoff is required.');
  if (!['retrospective','point_in_time'].includes(a.studyMode)) errors.push('Choose a valid study mode.');
  if (a.studyMode === 'point_in_time' && a.informationCutoff > a.valuationDate) errors.push('A point-in-time study cannot include information published after the valuation date.');
  return errors;
}
export function reconciliation(company) {
  const checks = [];
  const check = (year, label, left, right) => {
    const available = finite(left) && finite(right);
    const residual = available ? left - right : null;
    checks.push({year,label,residual,status:!available ? 'unavailable' : Math.abs(residual) <= 1 ? 'pass':'fail'});
  };
  for (const h of company.historical) {
    check(h.year,'Assets = equity + liabilities',h.assets, finite(h.equity) && finite(h.liabilities) ? h.equity+h.liabilities:null);
    check(h.year,'Cash flow subtotals',finite(h.cfo)&&finite(h.cfi)&&finite(h.cff) ? h.cfo+h.cfi+h.cff:null,h.netCashChange);
    check(h.year,'Opening cash to closing cash',finite(h.openingCash)&&finite(h.netCashChange)&&finite(h.fx) ? h.openingCash+h.netCashChange+h.fx:null,h.closingCash);
    check(h.year,'Cash flow to balance sheet',h.closingCash,h.cash);
  }
  return checks;
}
export function calculate(company, a) {
  const errors = [...validateCompany(company),...validateAssumptions(a)];
  if(errors.length) return {valid:false,errors,reconciliations:[]};
  const h = company.historical.at(-1);
  if (!h || company.historical.length < 3) errors.push('Three historical financial years are required.');
  if (h && !['revenue','receivables','payables'].every(k=>finite(h[k]))) errors.push('Source-backed revenue and operating working-capital inputs are required.');
  if (!finite(company.shares.netCrore) || company.shares.netCrore <= 0) errors.push('A positive sourced share denominator is required.');
  const rec = reconciliation(company);
  if (rec.some(r=>r.status!=='pass')) errors.push('Statement reconciliations must pass before valuation.');
  if (a.studyMode === 'point_in_time' && company.sources.some(s=>s.publicationDate > a.informationCutoff)) errors.push('The dataset contains documents published after the information cutoff.');
  if (errors.length) return {valid:false,errors,reconciliations:rec};
  let previousRevenue = h.revenue;
  let previousNwc = h.receivables-h.payables;
  const forecast=[];
  const daysPerYear=365.25*86400000;
  for(let i=0;i<5;i++) {
    const year=h.year+i+1;
    const cashflowDate=`${year}-03-31`;
    const time=(Date.parse(cashflowDate)-Date.parse(a.valuationDate))/daysPerYear;
    if(time<=0) return {valid:false,errors:['The valuation date must precede the first forecast year end. Refresh the base financial year for a later valuation.'],reconciliations:rec};
    const revenue=previousRevenue*(1+a.growth[i]);
    const ebit=revenue*a.margin;
    const nopat=ebit*(1-a.tax);
    const da=revenue*a.daRatio;
    const capex=revenue*a.capexRatio;
    const nwc=revenue*a.nwcRatio;
    const deltaNwc=nwc-previousNwc;
    const fcff=nopat+da-capex-deltaNwc;
    const discountFactor=(1+a.wacc)**(-time);
    forecast.push({year,revenue,ebit,nopat,da,capex,nwc,deltaNwc,fcff,time,discountFactor,pv:fcff*discountFactor});
    previousRevenue=revenue; previousNwc=nwc;
  }
  const last=forecast.at(-1);
  // Rebuild the terminal year so changing g also changes terminal reinvestment.
  const terminalRevenue=last.revenue*(1+a.terminalGrowth);
  const terminalNopat=terminalRevenue*a.margin*(1-a.tax);
  const terminalDa=terminalRevenue*a.daRatio;
  const terminalCapex=terminalRevenue*a.capexRatio;
  const terminalDeltaNwc=terminalRevenue*a.nwcRatio-last.nwc;
  const terminalFcff=terminalNopat+terminalDa-terminalCapex-terminalDeltaNwc;
  const terminalValue=terminalFcff/(a.wacc-a.terminalGrowth);
  const terminalPV=terminalValue*last.discountFactor;
  const forecastPV=forecast.reduce((s,r)=>s+r.pv,0);
  const enterpriseValue=forecastPV+terminalPV;
  const equityValue=enterpriseValue+a.excessCash-a.debt-a.leases-a.nci;
  const shares=company.shares.fullyDilutedCrore ?? company.shares.netCrore;
  const perShare=equityValue/shares;
  const compatibleMarket=validDirectMarket(company.market) && company.market.date===a.valuationDate && company.shares.date===a.valuationDate;
  const warnings=[];
  if(a.studyMode==='retrospective' && a.informationCutoff>a.valuationDate) warnings.push('Retrospective study: later-published annual reports are used. This is not a point-in-time trading signal.');
  if(!company.shares.fullyDilutedCrore) warnings.push('Period-end employee-award dilution is unavailable. Per-share value uses sourced net outstanding shares and remains provisional.');
  if(!company.bridgeReviewed) warnings.push('Excess cash and bridge assumptions require an analyst review. A zero cash allowance is an explicit scenario assumption.');
  if(company.sources.some(s=>s.verified!==true)) warnings.push('One or more imported source documents still require manual review.');
  if(!compatibleMarket) warnings.push('No same-date direct BSE close is loaded. Market upside and downside are unavailable.');
  if(a.valuationDate!==company.shares.date) warnings.push(`Share count is dated ${company.shares.date}; it does not match the selected valuation date.`);
  if(terminalCapex-terminalDa+terminalDeltaNwc<0) warnings.push('Terminal reinvestment is negative. Review sustainable growth and return-on-capital economics before relying on the model.');
  return {valid:true,errors:[],forecast,terminalRevenue,terminalFcff,terminalValue,terminalPV,forecastPV,enterpriseValue,equityValue,perShare,shares,terminalContribution:enterpriseValue===0?null:terminalPV/enterpriseValue,market:compatibleMarket?company.market:null,upside:compatibleMarket?perShare/company.market.price-1:null,warnings,reconciliations:rec,status:warnings.length?'provisional':'ready',modelVersion:MODEL_VERSION,assumptions:clone(a)};
}
export function sensitivity(company,a) {
  const wacc=[a.wacc-.02,a.wacc-.01,a.wacc,a.wacc+.01,a.wacc+.02];
  const growth=[a.terminalGrowth-.02,a.terminalGrowth-.01,a.terminalGrowth,a.terminalGrowth+.01,a.terminalGrowth+.02];
  return {wacc,growth,values:wacc.map(w=>growth.map(g=>{const r=calculate(company,{...a,wacc:w,terminalGrowth:g});return r.valid?r.perShare:null;}))};
}
export function peerMetrics(peer) {
  const result={...peer,ebitMargin:finite(peer.ebit)&&peer.revenue>0?peer.ebit/peer.revenue:null,netMargin:finite(peer.netIncome)&&peer.revenue>0?peer.netIncome/peer.revenue:null,pe:null,evEbit:null,evRevenue:null,enterpriseValue:null,marketCap:null};
  if(!validDirectMarket(peer.market) || !finite(peer.netSharesCrore) || peer.netSharesCrore<=0 || peer.market.date!==peer.shareDate) return result;
  result.marketCap=peer.market.price*peer.netSharesCrore;
  result.pe=peer.netIncome>0?result.marketCap/peer.netIncome:null;
  if(['debt','cash','leases','nci'].every(k=>finite(peer[k]))) {
    result.enterpriseValue=result.marketCap+peer.debt+peer.leases+peer.nci-peer.cash;
    result.evEbit=peer.ebit>0?result.enterpriseValue/peer.ebit:null;
    result.evRevenue=peer.revenue>0?result.enterpriseValue/peer.revenue:null;
  }
  return result;
}
export function median(values) {
  const xs=values.filter(finite).sort((a,b)=>a-b);
  return xs.length ? (xs[Math.floor((xs.length-1)/2)]+xs[Math.ceil((xs.length-1)/2)])/2:null;
}
export function makePacket(company,a,result,peerData=[]) {
  if(!result.valid) throw new Error(result.errors.join(' '));
  return {schemaVersion:'1.2',modelVersion:result.modelVersion??MODEL_VERSION,calculationAuthority:result.calculationAuthority??'interface_preview',purpose:'Educational retrospective equity research; not an investment recommendation.',company:{id:company.id,name:company.name,ticker:company.ticker,scrip:company.scrip},units:{financials:'INR crore',shares:'crore shares',perShare:'INR'},assumptions:clone(a),valuation:{enterpriseValue:result.enterpriseValue,equityValue:result.equityValue,valuePerShare:result.perShare,shares:result.shares,status:result.status},historical:clone(company.historical),sourceFacts:clone(company.facts??[]),forecast:clone(result.forecast),reconciliations:clone(result.reconciliations),warnings:clone(result.warnings),market:result.market,marketEvidence:result.marketEvidence??null,analytics:result.analytics??null,sensitivity:result.sensitivity??null,peerImpliedValues:result.peerImpliedValues??null,peers:result.peerComparison??peerData.map(peerMetrics),sources:clone(company.sources),inputManifest:company.inputManifest??null};
}
export function answerFromEvidence(question,company,a,result,peerData=[]) {
  const q=String(question).toLowerCase().slice(0,2000);
  const money=x=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:1}).format(x);
  const pct=x=>(x*100).toFixed(1)+'%';
  const latest=company.historical.at(-1), first=company.historical[0];
  const sourceIds=[...new Set(company.historical.flatMap(h=>h.sourceIds??[]))];
  let citations=company.sources.filter(s=>sourceIds.includes(s.id));
  let title='Research coverage',body;
  if(/revenue|sales|growth|performance/.test(q)) {
    title='Revenue and operating performance';
    const cagr=(latest.revenue/first.revenue)**(1/(latest.year-first.year))-1;
    body=`Revenue increased from ₹${money(first.revenue)} crore in FY${first.year} to ₹${money(latest.revenue)} crore in FY${latest.year}, a ${pct(cagr)} annualised increase. FY${latest.year} operating profit was ₹${money(latest.ebit)} crore (${pct(latest.ebit/latest.revenue)} of revenue). Forecast growth rates of ${a.growth.map(pct).join(', ')} are analyst assumptions, not reported results.`;
  } else if(/wacc|discount|cost of capital|terminal|sensitivity/.test(q)) {
    title='Discount rate and terminal value';
    body=`This scenario uses ${pct(a.wacc)} WACC and ${pct(a.terminalGrowth)} perpetual growth. These are editable educational assumptions. Terminal-year cash flow is rebuilt to reflect the selected growth and working-capital reinvestment. ${result.valid?`${pct(result.terminalContribution)} of model enterprise value comes from the terminal value.`:''} A researched WACC requires a risk-free rate, beta, equity risk premium, cost of debt and capital-structure evidence. The sensitivity matrix shows how these assumptions change the result.`;
  } else if(/cash|debt|bridge|lease|treasury|share|dilut/.test(q)) {
    title='Equity bridge and share denominator';
    body=`The model adds ₹${money(a.excessCash)} crore of assumed excess cash and deducts ₹${money(a.debt)} crore debt, ₹${money(a.leases)} crore leases and ₹${money(a.nci)} crore NCI. The denominator is ${money(company.shares.netCrore)} crore net outstanding shares dated ${company.shares.date}. Treasury shares are already excluded from this net count and are not deducted a second time. ${company.shares.fullyDilutedCrore?'A reviewed diluted denominator is available.':'Period-end employee-award dilution remains unavailable, so per-share output is provisional.'}`;
  } else if(/peer|compar|multiple|p\/e|ev\//.test(q)) {
    const peerSourceIds=peerData.map(p=>p.sourceId);
    citations=company.sources.filter(s=>peerSourceIds.includes(s.id));
    title='Comparable valuation coverage';
    const ready=peerData.map(peerMetrics).filter(p=>p.pe!==null);
    body=`The comparison covers ${peerData.map(p=>p.name).join(', ') || 'the active company'}. ${ready.length} peers have compatible direct prices and share counts for P/E. Missing prices or balance-sheet bridge data leave valuation multiples unavailable. Revenue and margins remain visible when sourced. A share price alone cannot establish a company's valuation multiple.`;
  } else if(/risk|limitation|reliable|trust|buy|sell|invest|target/.test(q)) {
    title='Model limitations and research risks';
    body=`This workbench produces an educational scenario value, not a buy/sell recommendation. ${result.warnings?.join(' ') || 'Complete the financial checks before interpreting the model.'} Key analytical risks include revenue-growth assumptions, margin sustainability, currency exposure, client spending and terminal reinvestment. These are research considerations; the workbench has not established a company-specific investment thesis.`;
  } else if(/value|valuation|worth|fcff|dcf|explain/.test(q)) {
    title='How this scenario is valued';
    body=result.valid?`The model discounts five years of FCFF: EBIT × (1 − tax) + depreciation − capex − the increase in operating working capital. Forecast cash flows contribute ₹${money(result.forecastPV)} crore and terminal value contributes ₹${money(result.terminalPV)} crore. After the equity bridge and share denominator, this scenario produces ₹${money(result.perShare)} per share. Forecasts and bridge inputs are assumptions. ${result.warnings[0]??''}`:'The current assumptions do not pass validation. Correct the highlighted inputs before requesting a valuation explanation.';
  } else if(/source|report|citation|data|audit/.test(q)) {
    title='Evidence and data lineage';
    body=`The historical snapshot covers FY${first.year}–FY${latest.year}, consolidated, in INR crore. Each source record carries a report URL, page reference and publication date. The Sources view exposes those records; the Audit view shows statement checks and local scenario changes. A checksum identifies the input snapshot; it is not a certificate of financial correctness.`;
  } else {
    body='I can explain the loaded revenue history, FCFF valuation, WACC, terminal value, share denominator, cash/debt bridge, peer coverage and model limitations. This evidence mode does not browse or invent an answer to an unsupported question. Ask about one of those topics or inspect the cited sources.';
  }
  return {title,body,citations,retrieval:retrieveEvidence(question,company,peerData),mode:'evidence',generatedAt:new Date().toISOString()};
}
