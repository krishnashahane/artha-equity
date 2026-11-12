/** Small BM25 retriever over reviewed source facts; no embeddings or remote calls. */
const stop=new Set(['the','a','an','and','or','of','to','is','are','was','were','in','on','for','what','how','why','does','do','me','show','explain','this','that','it','with','from','as']);
function tokenize(text){return String(text).toLowerCase().replaceAll('_',' ').match(/[a-z0-9]+/g)?.filter(t=>!stop.has(t)).map(t=>t.length>4&&t.endsWith('s')?t.slice(0,-1):t)??[];}
export function evidenceCorpus(company,peers=[]){
  const docs=(company.facts??[]).map(f=>({id:f.id,sourceId:f.sourceId,sourceUrl:f.sourceUrl,publicationDate:f.publicationDate,pdfPage:f.pdfPage,year:f.year,field:f.field,text:`${company.name} FY${f.year} ${f.field.replaceAll('_',' ')}: ${f.value} ${f.unit}. ${f.notes}`}));
  for(const p of peers){const source=company.sources.find(s=>s.id===p.sourceId);if(!source)continue;for(const [key,label]of[['revenue','reported revenue'],['ebit','reported operating EBIT profit'],['netIncome','reported net income attributable to owners']])docs.push({id:`${p.id}_fy${p.year}_${key}`,sourceId:p.sourceId,sourceUrl:source.url,publicationDate:source.publicationDate,pdfPage:source.pages,year:p.year,field:key,text:`${p.name} FY${p.year} ${label}: ${p[key]} INR crore. ${p.notes}`});}
  return docs;
}
export function retrieveEvidence(question,company,peers=[],limit=5){
  const query=tokenize(question),docs=evidenceCorpus(company,peers);
  if(!query.length||!docs.length)return [];
  const tokens=docs.map(d=>tokenize(d.text)),average=tokens.reduce((s,t)=>s+t.length,0)/tokens.length;
  const frequency=new Map();
  for(const terms of tokens)for(const term of new Set(terms))frequency.set(term,(frequency.get(term)??0)+1);
  const k=1.2,b=.75;
  return docs.map((d,i)=>{
    let score=0;
    for(const term of query){const tf=tokens[i].filter(t=>t===term).length;if(!tf)continue;const df=frequency.get(term)??0,idf=Math.log(1+(docs.length-df+.5)/(df+.5));score+=idf*tf*(k+1)/(tf+k*(1-b+b*tokens[i].length/average));}
    return {...d,score};
  }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||b.year-a.year).slice(0,Math.max(1,Math.min(10,limit)));
}
