const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {pickRun,mergeDraft}=require('../native-bridge.js');
const {normalise}=require('../widget-import.js');
const t=iso=>({epochMillis:Date.parse(iso),offsetSeconds:3600});
const run=(id,...times)=>({id,source:'watch',times:times.map(t)});
const rec=r=>normalise({version:1,id:r.id,times:r.times});
test('the newest set that isn’t already saved is picked',()=>{
 const a=run('a','2026-10-15T05:00:00Z'),b=run('b','2026-10-15T05:30:00Z','2026-10-15T07:00:00Z'),c=run('c','2026-10-15T06:00:00Z');
 assert.equal(pickRun([a,b,c],new Set()).id,'b');
 assert.equal(pickRun([a,b,c],new Set(['b'])).id,'c');
 assert.equal(pickRun([],new Set()),null);
});
test('watch times fill an empty draft and keep the job details already typed',()=>{
 const r=mergeDraft({jobNumber:'6029',vehicleReg:'LD68 ULM'},rec(run('w','2026-10-15T05:15:00Z')));
 assert.equal(r.changed,true);assert.equal(r.draft.startTime,'06:15');assert.equal(r.draft.date,'2026-10-15');
 assert.equal(r.draft.jobNumber,'6029');assert.equal(r.draft.vehicleReg,'LD68 ULM');assert.equal(r.draft._widget.id,'w');
});
test('later taps add only the new times, so hand corrections stay',()=>{
 const first=mergeDraft({},rec(run('w','2026-10-15T05:15:00Z'))).draft;
 first.startTime='06:00';
 const second=mergeDraft(first,rec(run('w','2026-10-15T05:15:00Z','2026-10-15T08:06:00Z')));
 assert.equal(second.added,1);assert.equal(second.draft.startTime,'06:00');assert.equal(second.draft.timeOnSite,'09:06');
 assert.deepEqual(mergeDraft(second.draft,rec(run('w','2026-10-15T05:15:00Z','2026-10-15T08:06:00Z'))),{draft:second.draft,changed:false,added:0});
});
test('a draft with other times is never overwritten',()=>{
 assert.equal(mergeDraft({startTime:'07:00'},rec(run('w','2026-10-15T05:15:00Z'))),null);
 assert.equal(mergeDraft({startTime:'07:00',_widget:{id:'other',times:[]}},rec(run('w','2026-10-15T05:15:00Z'))),null);
});
test('the bridge, backup and widget import are loaded by the app and cached offline',()=>{
 const template=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
 const sw=fs.readFileSync('sw.js','utf8');
 for(const f of ['native-bridge.js?v=82','data-backup.js?v=82','widget-import.js?v=82']){assert.ok(template.includes(f),f);assert.ok(sw.includes(f),f)}
 assert.ok(template.indexOf('widget-import.js')<template.indexOf('native-bridge.js'));
});
