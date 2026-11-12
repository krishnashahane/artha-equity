import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retrieveEvidence,evidenceCorpus} from '../public/retrieval.js';
const d=JSON.parse(readFileSync(new URL('../data/companies.json',import.meta.url),'utf8')),c=d.companies[0];
test('retrieval retains source pages, dates and document IDs',()=>{const rows=retrieveEvidence('Infosys FY2026 revenue',c,d.peers);assert.ok(rows.length);assert.ok(rows.some(r=>r.field==='revenue'&&r.year===2026));assert.ok(rows.every(r=>r.sourceId&&r.pdfPage&&r.publicationDate&&r.sourceUrl.startsWith('https://')));});
test('unmatched question does not invent an evidence chunk',()=>assert.deepEqual(retrieveEvidence('zxyqwerty',c,d.peers),[]));
test('every corpus fact resolves to an approved source document',()=>{assert.ok(evidenceCorpus(c,d.peers).every(f=>c.sources.some(s=>s.id===f.sourceId)));});
