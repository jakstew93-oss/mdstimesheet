const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['index.html','Index.html']){
 const source=fs.readFileSync(file,'utf8');
 const template=JSON.parse(source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
 const ctx={};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(template.slice(template.indexOf('  const BREAK_TABLE'),template.indexOf('  function abbreviateName(')),ctx);
 vm.runInContext(fs.readFileSync('workflow-ui.js','utf8').split('(function(){')[0],ctx);
 test(file+' calculates overnight and ordinary shifts with existing breaks',()=>{
  assert.equal(ctx.calcHours('08:00','00:10'),'16hrs 10m');
  assert.equal(ctx.afterBreakStr(ctx.calcHours('08:00','00:10')),'14hrs 55m');
  assert.equal(ctx.calcHours('22:00','06:00'),'8hrs');
  assert.equal(ctx.calcHours('23:50','00:10'),'20m');
  assert.equal(ctx.calcHours('08:00','00:00'),'16hrs');
  assert.equal(ctx.calcHours('08:00','16:10'),'8hrs 10m');
  assert.equal(ctx.calcHours('08:00','08:00'),'');
  assert.equal(ctx.calcHours('','00:10'),'');
 });
}
