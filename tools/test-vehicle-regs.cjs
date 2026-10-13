const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const r=require('../vehicle-regs.js');
test('the five company vans are in the list, in order',()=>{
 assert.deepEqual(r.mergeList([]).map(o=>o.reg+' '+o.label),['LA68 GEU Martyn’s van','LD68 ULM Jak’s van','SK69 PWV Matt’s van','AY22 HTF Ash’s van','BX22 VXR Big van']);
});
test('regs are tidied and matched however they are typed',()=>{
 assert.equal(r.tidy(' ld68ulm '),'LD68 ULM');assert.equal(r.tidy('ab12  cde'),'AB12 CDE');assert.equal(r.tidy('w123 abc'),'W123 ABC');assert.equal(r.tidy(''),'');
 assert.ok(r.sameReg('LD68ULM','ld68 ulm'));assert.ok(!r.sameReg('LD68 ULM','LD68 ULN'));
});
test('new regs can be added once and removed, but fleet vans stay',()=>{
 let saved=r.addReg([],'yk21 abc','Hire van');assert.deepEqual(saved,[{reg:'YK21 ABC',label:'Hire van'}]);
 assert.equal(r.addReg(saved,'YK21ABC','dup'),saved);assert.equal(r.addReg(saved,'LD68 ULM',''),saved);assert.equal(r.addReg(saved,'  ',''),saved);
 const list=r.mergeList(saved);assert.equal(list.length,6);assert.deepEqual(list[5],{reg:'YK21 ABC',label:'Hire van',fleet:false});
 assert.deepEqual(r.removeReg(saved,'yk21abc'),[]);
 assert.equal(r.mergeList(r.removeReg(saved,'LD68 ULM')).length,6);
});
test('the dropdown is loaded by the app and cached offline',()=>{
 const template=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
 assert.match(template,/vehicle-regs\.js\?v=80/);assert.match(template,/vehicle-regs\.css\?v=80/);
 const sw=fs.readFileSync('sw.js','utf8');for(const f of ['vehicle-regs.js?v=80','vehicle-regs.css?v=80'])assert.ok(sw.includes(f),f);
});
