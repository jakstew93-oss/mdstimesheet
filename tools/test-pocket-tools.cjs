const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const t=require('../pocket-tools.js');
test('max Zs matches BS 7671 Table 41.3 for type B, C and D breakers',()=>{
 const table={B:{6:7.28,10:4.37,16:2.73,20:2.19,25:1.75,32:1.37,40:1.09,50:0.87,63:0.69},C:{6:3.64,10:2.19,16:1.37,20:1.09,25:0.87,32:0.68,40:0.55,50:0.44,63:0.35},D:{6:1.82,10:1.09,16:0.68,20:0.55,25:0.44,32:0.34,40:0.27,50:0.22,63:0.17}};
 for(const [type,ratings] of Object.entries(table))for(const [rating,zs] of Object.entries(ratings))assert.equal(t.maxZs(type,Number(rating)),zs,type+rating);
 assert.equal(t.measuredLimit(1.37),1.1);assert.equal(t.rcdMaxZs(30),1667);assert.equal(t.rcdMaxZs(100),500);assert.equal(t.maxZs('X',32),null);
});
test('voltage drop uses mV/A/m × Ib × length against 3% / 5%',()=>{
 const r=t.voltDrop(t.VD_CABLES.te.mv['2.5'],20,25,1,false);
 assert.equal(r.volts,9);assert.equal(Math.round(r.percent*100)/100,3.91);assert.equal(r.limitVolts,11.5);assert.ok(r.ok);
 assert.ok(!t.voltDrop(18,20,25,1,true).ok);assert.equal(t.voltDrop(18,20,25,1,true).limitVolts,6.9);
 assert.equal(t.voltDrop(t.VD_CABLES.swa34.mv['10'],32,50,3,false).limitVolts,20);
 assert.equal(t.VD_CABLES.te.mv['1.5'],29);assert.equal(t.VD_CABLES.te.mv['6'],7.3);assert.equal(t.VD_CABLES.te.mv['10'],4.4);
});
test('expected Zs, ring final and fault current',()=>{
 assert.deepEqual(t.expectedZs(0.35,'2.5/1.5',30),{r1r2:0.59,r1r2Hot:0.7,zs:1.05});
 assert.equal(t.R1R2['1.5/1.0'],30.2);assert.equal(t.R1R2['6/2.5'],10.49);
 const ring=t.ringCheck(0.6,0.6,1.0);assert.ok(ring.lineNeutralOk);assert.ok(ring.ratioOk);assert.equal(ring.r1r2,0.4);assert.equal(ring.r1rn,0.3);
 assert.ok(!t.ringCheck(0.5,0.6,0.84).lineNeutralOk);assert.ok(!t.ringCheck(0.5,0.5,0.5).ratioOk);
 assert.equal(t.faultCurrent(0.35),0.66);assert.equal(t.faultCurrent(0),null);
});
test('Ohm’s law solves from any two values and load current handles three-phase',()=>{
 const close=(a,b)=>assert.ok(Math.abs(a-b)<0.01,a+' vs '+b);
 let r=t.ohms({V:230,P:3000});close(r.I,13.04);close(r.R,17.63);
 r=t.ohms({I:10,R:23});close(r.V,230);close(r.P,2300);
 r=t.ohms({R:20,P:2000});close(r.V,200);close(r.I,10);
 assert.equal(t.ohms({V:230}),null);assert.equal(t.ohms({V:230,I:10,R:23}),null);
 close(t.loadCurrent(9.5,230,1,1),41.30);close(t.loadCurrent(10,400,0.9,3),16.04);assert.equal(t.loadCurrent(10,400,1.2,3),null);
});
test('cable size helper picks the smallest twin & earth that carries the breaker and meets volt drop',()=>{
 const base={ambient:30,circuits:1,metres:20,lighting:false};
 let r=t.cableSize({...base,ib:28,rating:32,method:'C'});assert.equal(r.suggestion.size,'4');assert.equal(r.neededIt,32);
 assert.equal(t.cableSize({...base,ib:16,rating:16,method:'103'}).suggestion.size,'4');
 assert.equal(t.cableSize({...base,ib:16,rating:16,method:'101'}).suggestion.size,'2.5');
 r=t.cableSize({...base,ib:20,rating:20,method:'C',circuits:2});assert.equal(r.neededIt,25);assert.equal(r.suggestion.size,'2.5');
 assert.equal(t.cableSize({...base,ib:20,rating:20,method:'C',metres:60}).suggestion.size,'6');
 assert.ok(!t.cableSize({...base,ib:40,rating:32,method:'C'}).ratingOk);
 assert.equal(t.TE_METHODS.C.amps[2],27);assert.equal(t.TE_METHODS['103'].amps[2],13.5);assert.equal(t.AMBIENT[40],0.87);assert.equal(t.GROUPING[2],0.7);
});
test('Pocket Tools is loaded by the app and cached offline',()=>{
 const template=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
 assert.match(template,/pocket-tools\.js\?v=78/);assert.match(template,/pocket-tools\.css\?v=78/);
 const sw=fs.readFileSync('sw.js','utf8');for(const f of ['pocket-tools.js?v=78','pocket-tools.css?v=78'])assert.ok(sw.includes(f),f);
});
