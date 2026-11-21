const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const status=require('../shift-status.js');

test('breakInfo matches the app break schedule and next threshold',()=>{
 assert.deepEqual(status.breakInfo(360),{current:0,after:360,next:{atHours:7,mins:20,inMins:60}});
 assert.deepEqual(status.breakInfo(420),{current:20,after:400,next:{atHours:9,mins:30,inMins:120}});
 assert.deepEqual(status.breakInfo(540),{current:30,after:510,next:{atHours:10,mins:45,inMins:60}});
 assert.deepEqual(status.breakInfo(1140),{current:105,after:1035,next:null});
});

test('summarize shows live shift duration and warns within 30 minutes of a break threshold',()=>{
 const now=new Date('2026-11-21T13:45:00');
 const live=status.summarize({date:'2026-11-21',startTime:'07:00'},0,now,'2026-11-21');
 assert.equal(live.mode,'live');
 assert.equal(live.shiftMins,405);
 assert.equal(live.warn,true);
 assert.match(live.headline,/6h 45m/);
 assert.match(live.detail,/20m break in 15m/);
});

test('summarize combines prior jobs on the same day and handles completed shifts',()=>{
 const done=status.summarize({date:'2026-11-21',startTime:'12:00',endTime:'17:00'},300,new Date('2026-11-21T18:00:00'),'2026-11-21');
 assert.equal(done.mode,'done');
 assert.equal(done.combined,600);
 assert.match(done.headline,/day total 10h/);
 assert.match(done.detail,/45m break · 9h 15m paid/);
});

test('shift-status is loaded by the app and cached offline',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 assert.ok(html.includes('shift-status.js?v=1'));
 assert.ok(html.includes('shift-status.css?v=1'));
 assert.ok(sw.includes('./shift-status.js?v=1'));
 assert.ok(sw.includes('./shift-status.css?v=1'));
});
