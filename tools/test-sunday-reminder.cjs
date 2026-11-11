const {test}=require('node:test');
const assert=require('node:assert/strict');
const s=require('../sunday-reminder.js');

test('only the timesheet PDF counts as sending the timesheet',()=>{
 assert.ok(s.isTimesheet('Timesheet 15-11-2026.pdf'));
 assert.ok(!s.isTimesheet('Holiday Jak Stewart.pdf'));
 assert.ok(!s.isTimesheet('Timesheet 15-11-2026.csv'));
 assert.ok(!s.isTimesheet(''));
});
test('a share Android reports back is matched to the week it was started for',()=>{
 const pending={week:'2026-11-15',name:'Timesheet 15-11-2026.pdf',at:1000000};
 assert.deepEqual(s.matchShare(pending,{name:pending.name,app:'Gmail',at:1004000},1005000),{week:'2026-11-15',at:1004000,via:'Gmail'});
 assert.equal(s.matchShare(pending,{name:'Van Check.pdf',app:'Gmail',at:1004000},1005000),null);
 assert.equal(s.matchShare(pending,{name:pending.name,app:'Gmail',at:900000},1005000),null);   // an earlier share
 assert.equal(s.matchShare(pending,null,1005000),null);                                        // share menu closed
 assert.equal(s.matchShare(pending,{name:pending.name,app:'Gmail',at:1004000},1000000+16*60*1000),null);
});
test('weeks can be marked and un-marked, keeping the last twelve',()=>{
 let log={};
 for(let i=1;i<=14;i++)log=s.markSent(log,'2026-01-'+String(i).padStart(2,'0'),i,'');
 assert.equal(Object.keys(log).length,12);
 assert.ok(!log['2026-01-01']&&log['2026-01-14']);
 assert.deepEqual(s.markSent({},'2026-11-15',5,'Gmail'),{'2026-11-15':{at:5,via:'Gmail'}});
 assert.deepEqual(s.unmark({'2026-11-15':{at:5,via:''}},'2026-11-15'),{});
});
test('the app is told 9am Sunday and the sent weeks, or nothing when the reminder is off',()=>{
 assert.deepEqual(s.reminderState({'2026-11-15':{at:1},'2026-11-08':{at:1}},true),{enabled:true,hour:9,minute:0,sentWeeks:['2026-11-08','2026-11-15']});
 assert.deepEqual(s.reminderState({'2026-11-15':{at:1}},false),{enabled:false,hour:9,minute:0,sentWeeks:[]});
});
