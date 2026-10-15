process.env.TZ='Europe/London';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {pickRun,mergeDraft,draftTimes,dayMessage}=require('../native-bridge.js');
const {normalise}=require('../widget-import.js');
const t=iso=>({epochMillis:Date.parse(iso),offsetSeconds:3600});
const run=(id,...times)=>({id,source:'watch',times:times.map(t)});
const rec=r=>normalise({version:1,id:r.id,times:r.times});
test('the newest set that isn’t already saved is picked',()=>{
 const a=run('a','2026-10-15T05:00:00Z'),b=run('b','2026-10-15T05:30:00Z','2026-10-15T07:00:00Z'),c=run('c','2026-10-15T06:00:00Z');
 assert.equal(pickRun([a,b,c],new Set()).id,'b');
 assert.equal(pickRun([a,b,c],new Set(['b'])).id,'c');
 assert.equal(pickRun([],new Set()),null);
 assert.equal(pickRun([a,b,c],new Set(),'a').id,'a','the set already in Quick Start comes first');
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
 for(const f of ['native-bridge.js?v=84','data-backup.js?v=82','widget-import.js?v=82']){assert.ok(template.includes(f),f);assert.ok(sw.includes(f),f)}
 assert.ok(template.indexOf('widget-import.js')<template.indexOf('native-bridge.js'));
});
test('after Reset, stages already brought in stay gone and only newer taps come back',()=>{
 const two=rec(run('w','2026-10-15T05:15:00Z','2026-10-15T08:06:00Z'));
 const seen=two.draft._widget.times.map(x=>x.epochMillis);
 assert.deepEqual(mergeDraft({},two,seen),{draft:{},changed:false,added:0});
 const three=rec(run('w','2026-10-15T05:15:00Z','2026-10-15T08:06:00Z','2026-10-15T10:30:00Z'));
 const back=mergeDraft({jobNumber:'7'},three,seen);
 assert.equal(back.added,1);assert.equal(back.draft.timeOffSite,'11:30');assert.equal(back.last,2);
 assert.equal(back.draft.startTime,undefined);assert.equal(back.draft.timeOnSite,undefined);assert.equal(back.draft.jobNumber,'7');
});
test('a time cleared by hand on the phone stays cleared when the watch sends its next tap',()=>{
 const draft={date:'2026-10-15',startTime:'06:15',_widget:{id:'w',times:[t('2026-10-15T05:15:00Z')]}};
 const r=mergeDraft(draft,rec(run('w','2026-10-15T05:15:00Z','2026-10-15T08:06:00Z','2026-10-15T10:30:00Z')),[Date.parse('2026-10-15T08:06:00Z')]);
 assert.equal(r.draft.timeOnSite,undefined);assert.equal(r.draft.timeOffSite,'11:30');
});
test('on a day the watch took over from the phone, only the watch’s own taps come in',()=>{
 const draft={date:'2026-10-15',startTime:'06:00',timeOnSite:'09:00',_widget:{id:'p',times:[t('2026-10-15T05:00:00Z')]}};
 // The watch holds the phone's two times, then Off site was tapped on the watch.
 const watch=rec(run('p','2026-10-15T05:00:00Z','2026-10-15T08:00:00Z','2026-10-15T10:30:00Z'));
 const r=mergeDraft(draft,watch,[],2);
 assert.equal(r.added,1);assert.equal(r.draft.startTime,'06:00');assert.equal(r.draft.timeOnSite,'09:00');assert.equal(r.draft.timeOffSite,'11:30');
});
test('times typed on the phone become tap times for the watch, in order and past midnight',()=>{
 const times=draftTimes({date:'2026-10-15',startTime:'16:00',timeOnSite:'17:30',timeOffSite:'00:15'},'2026-10-15');
 assert.deepEqual(times.map(x=>new Date(x.epochMillis).toISOString()),['2026-10-15T15:00:00.000Z','2026-10-15T16:30:00.000Z','2026-10-15T23:15:00.000Z']);
 assert.equal(times[0].offsetSeconds,3600);
 assert.equal(draftTimes({date:'2026-10-15',timeOnSite:'09:00'},'2026-10-15').length,0,'nothing is sent without a start time');
 assert.equal(draftTimes({startTime:'07:00',timeOffSite:'12:00'},'2026-10-15').length,1,'stops at the first empty stage');
 const watchTime=t('2026-10-15T05:15:42.123Z');
 assert.deepEqual(draftTimes({date:'2026-10-15',startTime:'06:15',_widget:{id:'w',times:[watchTime]}},'2026-10-15'),[watchTime],'the watch’s exact time is kept');
});
test('the watch is told when a day is started, cleared by Reset or saved',()=>{
 const active=dayMessage({date:'2026-10-15',startTime:'07:00',_widget:{id:'p',times:[]}},[1],null,false,'2026-10-15');
 assert.equal(active.state,'active');assert.equal(active.id,'p');assert.equal(active.times.length,1);assert.deepEqual(active.seen,[1]);
 assert.equal(dayMessage({startTime:'07:00'},[],null,false,'2026-10-15').id,null,'a day started on the phone needs an id');
 assert.deepEqual(dayMessage({},[],{id:'p',state:'active'},false,'2026-10-15'),{state:'cleared',id:'p',times:[],seen:[]});
 assert.equal(dayMessage({},[],{id:'p',state:'active'},true,'2026-10-15').state,'saved');
 assert.equal(dayMessage({},[],{id:'p',state:'cleared'},false,'2026-10-15'),null);
 assert.equal(dayMessage({jobNumber:'7'},[],null,false,'2026-10-15'),null);
});
