const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const api=require('../timesheet-tools.js');
const full={id:1,date:'2026-10-04',jobNumber:'100',vehicleReg:'AB12 CDE',driverName:'Jak Stewart',startTime:'07:00',timeOnSite:'08:00',timeOffSite:'15:00',endTime:'16:00',totalHours:'9hrs',widgetTimestamps:[{epochMillis:1791097200123,offsetSeconds:3600}]};
test('migration preserves every entry and separates weeks including year boundaries',()=>{
 const entries=[full,{...full,id:2,date:'2026-09-27'},{...full,id:3,date:'2026-12-31'}, {...full,id:4,date:''}];
 const data=api.migrate(entries,'2026-10-04');
 assert.deepEqual(data.weeks['2026-10-04'].entries,[full,entries[3]]);
 assert.equal(data.weeks['2026-09-27'].archived,true);
 assert.deepEqual(data.weeks['2027-01-03'].entries,[entries[2]]);
 assert.equal(Object.values(data.weeks).flatMap(w=>w.entries).length,entries.length);
 assert.equal(api.nextWeek('2026-12-27'),'2027-01-03');
});
test('checks distinguish valid holidays, overnight work, missing details and duplicates',()=>{
 assert.deepEqual(api.checkEntries([full],'2026-10-04'),[]);
 assert.deepEqual(api.checkEntries([{id:5,date:'2026-10-01',hol:true}],'2026-10-04'),[]);
 assert.deepEqual(api.checkEntries([{...full,startTime:'22:00',timeOnSite:'23:00',timeOffSite:'01:00',endTime:'02:00'}],'2026-10-04'),[]);
 assert.match(api.checkEntries([{...full,timeOnSite:'',jobNumber:''}],'2026-10-04').map(x=>x.message).join(' '),/Missing job number.*Missing on-site/);
 assert.match(api.checkEntries([full,{...full,id:2}],'2026-10-04')[0].message,/duplicate/);
 assert.match(api.checkEntries([{...full,timeOffSite:'06:00'}],'2026-10-04')[0].message,/order/);
 assert.match(api.checkEntries([{...full,date:'2026-09-27'}],'2026-10-04')[0].message,/outside/);
});
test('undo restores removed entries without overwriting later changes or duplicating IDs',()=>{
 const data={version:1,weeks:{'2026-10-04':{entries:[{...full,id:2,jobNumber:'later edit'}],archived:false}}};
 const items=[{week:'2026-10-04',entry:full},{week:'2026-09-27',entry:{...full,id:3,date:'2026-09-27'}}];
 api.restoreDeleted(data,items);api.restoreDeleted(data,items);
 assert.equal(data.weeks['2026-10-04'].entries.length,2);
 assert.equal(data.weeks['2026-10-04'].entries.find(e=>e.id===2).jobNumber,'later edit');
 assert.deepEqual(data.weeks['2026-10-04'].entries.find(e=>e.id===1).widgetTimestamps,full.widgetTimestamps);
 assert.equal(data.weeks['2026-09-27'].entries.length,1);
});
function app(){
 const text=fs.readFileSync('index.html','utf8');const template=JSON.parse(text.split('<script type="__bundler/template">')[1].trimStart().split('\n')[0]);
 const functions=template.slice(template.indexOf('  function empSuffix()'),template.indexOf('  function updateWeekLabel()'));
 const values=new Map([['timesheet_employee','Jak Stewart'],['timesheet_week_jak_stewart','2026-10-04'],['timesheet_entries_jak_stewart',JSON.stringify([full,{...full,id:2,date:'2026-09-27'}])]]);
 const ctx={Date,MDSTools:api,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))},document:{getElementById:()=>({value:''})},updateWeekLabel:()=>{}};
 vm.createContext(ctx);vm.runInContext("const EMP_KEY='timesheet_employee',WEEK_KEY='timesheet_week',STORAGE_KEY='timesheet_entries';"+functions,ctx);
 return {ctx,values};
}
test('saving one week and remembering details does not alter another employee or week',()=>{
 const {ctx,values}=app();assert.equal(ctx.getEntries().length,1);
 ctx.saveEntries([{...full,jobNumber:'edited'}]);values.set('timesheet_week_jak_stewart','2026-09-27');assert.equal(ctx.getEntries()[0].jobNumber,'100');
 assert.equal(JSON.parse(values.get('timesheet_entries_jak_stewart')).length,2);
 ctx.rememberEntryDetails(full);assert.equal(ctx.usualDetails().driverName,'Jak Stewart');
 values.set('timesheet_employee','Cody Slack');assert.equal(ctx.getEntries().length,0);assert.equal(ctx.usualDetails().driverName,undefined);
});
