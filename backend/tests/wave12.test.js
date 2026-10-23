const test=require('node:test'); const assert=require('node:assert/strict'); const {toCsv,providerConfigured,outbreakSummary,treatmentWindow}=require('../wave12');
test('csv quoting',()=>{ assert.ok(toCsv([{a:'x,y',n:0}]).includes('"x,y"')); });
test('outbreak fallback incl zero',()=>{ const r=outbreakSummary([{disease_name:'rust',severity:'low'}]); const g=l=>r.sections.find(s=>s.label===l).value; assert.equal(r.aiGenerated,false); assert.equal(g('High severity count'),0); assert.equal(g('Has detections'),true); assert.equal(outbreakSummary([]).sections.find(s=>s.label==='Detections reviewed').value,0); });
test('treatment window counts',()=>{ const r=treatmentWindow([{treatment_applied:'',status:'open'},{treatment_applied:'x',status:'treated'}]); assert.equal(r.sections.find(s=>s.label==='Awaiting treatment').value,1); });
test('provider gate',()=>{ assert.equal(providerConfigured({}),false); });
