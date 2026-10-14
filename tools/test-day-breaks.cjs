const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const template=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
const slice=(from,to)=>template.slice(template.indexOf(from),template.indexOf(to));
function setup(entries){
 let csv='',text='';
 const ctx={entries,localStorage:{getItem:()=>'2026-10-18'},Blob:function(parts){csv=parts.join('')},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},
  document:{createElement:()=>({click(){}})},showToast:()=>{},formatDate:d=>d,navigator:{clipboard:{writeText:t=>{text=t;return Promise.resolve()}}}};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(slice('  const BREAK_TABLE','  function abbreviateName(')+slice('  function getDailyBreaks(','  function empSuffix(')+slice('  function exportCSV(','  function clearAll(')+'\nfunction getEntries(){return entries}\nfunction getWeekKey(){return "w"}\nconst EMP_KEY="e";',ctx);
 return {ctx,out:()=>({csv,text})};
}
const twoJobs=[{id:1,date:'2026-10-13',jobNumber:'101',totalHours:'5hrs',breakMins:0},{id:2,date:'2026-10-13',jobNumber:'102',totalHours:'5hrs',breakMins:0},{id:3,date:'2026-10-14',jobNumber:'103',totalHours:'9hrs',breakMins:30}];
test('two jobs on one day share one break worked out from the combined hours',()=>{
 const {ctx}=setup(twoJobs);
 assert.equal(ctx.dayBreakFor(twoJobs[0]),null);
 assert.deepEqual({...ctx.dayBreakFor(twoJobs[1])},{breakMins:45,after:'9hrs 15m',multi:true});
 assert.deepEqual({...ctx.dayBreakFor(twoJobs[2])},{breakMins:30,after:'8hrs 30m',multi:false});
});
test('CSV and Copy as Text show the combined day break and totals',async()=>{
 const {ctx,out}=setup(twoJobs);ctx.exportCSV();await ctx.copyToClipboard();
 const {csv,text}=out();
 assert.match(csv,/"101",.*"5hrs","",/);assert.match(csv,/"102",.*"5hrs","9hrs 15m",/);assert.match(csv,/"103",.*"9hrs","8hrs 30m",/);
 assert.match(csv,/Total Breaks,-1 hr 15 mins\nAfter Breaks,17hrs 45m/);
 assert.match(text,/Day after break: 9hrs 15m/);assert.match(text,/  After break: 8hrs 30m/);assert.equal((text.match(/after break/gi)||[]).length,3);
 assert.match(text,/Total: 19hrs  After breaks: 17hrs 45m/);
});
test('the Log, preview and save message use the day’s combined break',()=>{
 assert.ok(template.includes("'<div class=\"entry-v2-totals mds-day-totals\"><span class=\"ttchip ttchip-total\">Day total '"));
 assert.ok(template.includes("const db = dayBreakFor(e, sheetDays);"));
 assert.ok(template.includes("savedDay.entries.length > 1 ? 'Day after breaks' : 'After breaks'"));
 assert.ok(!template.includes("const brk = e.breakMins || 0;"));
});
