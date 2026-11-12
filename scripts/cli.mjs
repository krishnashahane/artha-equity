import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {calculate,defaults,makePacket} from '../public/engine.js';
import {pythonOperation} from '../backend/python_bridge.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(readFileSync(path.join(root,'data/companies.json'),'utf8'));
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const id=option('--company','infosys'),scenario=option('--scenario','base');
const company=data.companies.find(c=>c.id===id);
if(!company){console.error('Unknown company: '+id);process.exit(1);}
if(!['base','bull','bear'].includes(scenario)){console.error('Scenario must be base, bull or bear.');process.exit(1);}
let a=defaults(company,scenario);
const assumptionPath=option('--assumptions',null);
if(assumptionPath)a=JSON.parse(readFileSync(path.resolve(assumptionPath),'utf8'));
const result=await pythonOperation({action:'valuation',companyId:company.id,assumptions:a});
if(!result.valid){console.error(result.errors.join('\n'));process.exit(1);}
const packet=makePacket(company,a,result,data.peers),output=option('--output',null),serialized=JSON.stringify(packet,null,2)+'\n';
if(output){writeFileSync(path.resolve(output),serialized);console.log('Saved research packet to '+output);}else console.log(serialized);
