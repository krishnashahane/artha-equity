/** Presentation helpers only. Python is the sole calculation authority. */
/** @template T @param {T} value @returns {T} */
export const clone=value=>JSON.parse(JSON.stringify(value));
export function defaults(company, scenario = 'base') {
  const a = clone(company.assumptions);
  if (scenario === 'bull') {
    a.growth = a.growth.map((x) => x + .02);
    a.margin += .015;
    if(a.margins)a.margins=a.margins.map(m=>m+.015);
    a.wacc = Math.max(.05, a.wacc - .01);
  }
  if (scenario === 'bear') {
    a.growth = a.growth.map((x) => Math.max(-.8, x - .03));
    a.margin -= .02;
    if(a.margins)a.margins=a.margins.map(m=>m-.02);
    a.wacc += .015;
  }
  return a;
}

export function makePacket(company,a,result,peerData=[]) {
  if(!result.valid) throw new Error(result.errors.join(' '));
  return {schemaVersion:'1.2',modelVersion:result.modelVersion??'1.4.0',calculationAuthority:result.calculationAuthority??'interface_preview',purpose:'Educational retrospective equity research; not an investment recommendation.',company:{id:company.id,name:company.name,ticker:company.ticker,scrip:company.scrip},units:{financials:'INR crore',shares:'crore shares',perShare:'INR'},assumptions:clone(a),valuation:{enterpriseValue:result.enterpriseValue,equityValue:result.equityValue,valuePerShare:result.perShare,shares:result.shares,status:result.status},historical:clone(company.historical),sourceFacts:clone(company.facts??[]),forecast:clone(result.forecast),reconciliations:clone(result.reconciliations),warnings:clone(result.warnings),market:result.market,marketEvidence:result.marketEvidence??null,analytics:result.analytics??null,sensitivity:result.sensitivity??null,peerImpliedValues:result.peerImpliedValues??null,peers:result.peerComparison??[],sources:clone(company.sources),inputManifest:company.inputManifest??null};
}
