const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
const template=JSON.parse(source.split('<script type="__bundler/template">')[1].trimStart().split('\n')[0]);
const functions=template.slice(template.indexOf('  function currentWeekEnding('),template.indexOf('  function updateWeekLabel()'));
function setup(){
 const values=new Map();const input={value:''};
 const ctx={Date,employee:'jak',localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))},document:{getElementById:()=>input},updateWeekLabel:()=>{}};
 vm.createContext(ctx);vm.runInContext('function getWeekKey(){return "week_"+employee;}\n'+functions,ctx);
 return {ctx,values,input};
}
test('current Sunday stays in this week; Monday advances including year boundaries',()=>{
 const {ctx}=setup();
 for(const [day,end] of [['2026-10-04','2026-10-04'],['2026-10-05','2026-10-11'],['2026-12-31','2027-01-03'],['2026-03-29','2026-03-29']]){
  assert.equal(ctx.currentWeekEnding(new Date(day+'T23:59:00')),end);
 }
});
test('automatic selection advances while a manual override persists per employee',()=>{
 const {ctx,values,input}=setup();
 assert.equal(ctx.resolveWeekEnding(new Date('2026-10-04T12:00:00')),'2026-10-04');
 assert.equal(ctx.resolveWeekEnding(new Date('2026-10-05T00:01:00')),'2026-10-11');
 input.value='2026-09-27';ctx.saveWeekEnding();
 assert.equal(ctx.resolveWeekEnding(new Date('2026-10-12T12:00:00')),'2026-09-27');
 ctx.employee='other';assert.equal(ctx.resolveWeekEnding(new Date('2026-10-12T12:00:00')),'2026-10-18');
 ctx.employee='jak';values.set('week_jak_mode','auto');
 assert.equal(ctx.resolveWeekEnding(new Date('2026-10-12T12:00:00')),'2026-10-18');
});
