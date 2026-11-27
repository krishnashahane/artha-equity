/** Native ES module; no build-time dependency or financial calculation authority. */
import {$,e,n,money,percent,dated,paths,icon,company,peers,cases,state,toastTimer,button,linkButton,runtime,dataset,clone,read,write,event,toast,setCompany,compiled} from './state.js';

/** historyChart UI helper. */
export function historyChart(){const key=state.chart,h=company.historical,max=Math.max(...h.map(x=>x[key]))*1.22,w=1010,height=245,left=54,right=31,top=26,bottom=38,x=i=>left+i*(w-left-right)/2,y=v=>top+(max-v)*(height-top-bottom)/max;const pts=h.map((p,i)=>`${i?'L':'M'}${x(i)} ${y(p[key])}`).join(' ');return `<svg class="chart-svg" viewBox="0 0 ${w} ${height}" role="img" aria-label="Reported ${key==='revenue'?'revenue':key==='ebit'?'operating profit':'operating cash flow'} for FY${h[0].year} through FY${h.at(-1).year}, in INR crore">${[0,.33,.66,1].map(t=>`<line x1="${left}" y1="${y(max*t)}" x2="${w-right}" y2="${y(max*t)}" stroke="#eeeeF2" stroke-dasharray="2 5"/><text x="${left-13}" y="${y(max*t)+4}" text-anchor="end" class="chart-label">${n(max*t/1000)}k</text>`).join('')}<path d="${pts}" fill="none" stroke="#658bb6" stroke-width="2.3" stroke-linecap="round"/>${h.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p[key])}" r="4" fill="#658bb6" stroke="white" stroke-width="3"><title>FY${p.year}: ${money(p[key])} crore</title></circle><text x="${x(i)}" y="${height-11}" text-anchor="middle" class="chart-label">FY${p.year}</text>${i===2?`<text x="${x(i)-3}" y="${y(p[key])-16}" text-anchor="end" fill="#777f8d" style="font:12px var(--font)">${money(p[key])}</text>`:''}`).join('')}</svg>`;}

/** Position Python-supplied bridge steps; no financial totals are calculated here.
 * @param {{label:string,value:number,start:number,end:number,total:boolean}[]} steps
 * @returns {string} Accessible inline SVG markup.
 */
export function waterfallChart(steps){
  if(!steps.length)return '';
  const values=steps.flatMap(s=>[s.start,s.end]),lo=Math.min(0,...values),hi=Math.max(0,...values),range=hi-lo||1,y=v=>25+(hi-v)/range*190;
  return `<svg class="chart-svg waterfall" viewBox="0 0 900 260" role="img" aria-labelledby="bridge-title bridge-desc"><title id="bridge-title">Enterprise value to equity value</title><desc id="bridge-desc">${steps.map(s=>e(s.label)+': '+money(s.value)+' crore').join('; ')}. Exact values are in the table below.</desc><line x1="0" x2="900" y1="${y(0)}" y2="${y(0)}"/>${steps.map((s,i)=>`<rect class="${s.total?'total':'movement'}" x="${i*150+25}" y="${Math.min(y(s.start),y(s.end))}" width="95" height="${Math.max(1,Math.abs(y(s.end)-y(s.start)))}"><title>${e(s.label)}: ${money(s.value)} crore</title></rect><text x="${i*150+72}" y="245" text-anchor="middle" font-size="12">${e(s.label)}</text>`).join('')}</svg>`;
}

/** Present Python-supplied histogram bins with an accessible table.
 * @param {{low:number,high:number,count:number}[]} bins
 * @returns {string}
 */
export function histogramChart(bins){
  const max=Math.max(...bins.map(b=>b.count),1);
  return `<svg viewBox="0 0 600 180" class="chart-svg" role="img" aria-label="Illustrative per-share scenario distribution"><title>Monte Carlo scenario counts by per-share value bin</title>${bins.map((b,i)=>`<rect x="${i*30+2}" y="${160-b.count/max*145}" width="25" height="${b.count/max*145}" fill="currentColor"><title>${money(b.low,2)} to ${money(b.high,2)}: ${b.count} simulations</title></rect>`).join('')}</svg><details><summary>Distribution data table</summary><table class="data-table"><thead><tr><th>Value range · INR/share</th><th>Count</th></tr></thead><tbody>${bins.map(b=>`<tr><td>${money(b.low,2)}–${money(b.high,2)}</td><td>${b.count}</td></tr>`).join('')}</tbody></table></details>`;
}
