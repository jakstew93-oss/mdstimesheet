const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalise}=require('../widget-import.js');
test('uses the captured local time and retains millisecond precision',()=>{
 const epochMillis=Date.parse('2026-10-04T06:12:34.567Z');
 const result=normalise({version:1,id:'capture-1',times:[{epochMillis,offsetSeconds:3600}]});
 assert.equal(result.draft.startTime,'07:12');
 assert.equal(result.draft.date,'2026-10-04');
 assert.equal(result.draft._widget.times[0].epochMillis,epochMillis);
});
test('retains overnight dates and does not substitute transfer time',()=>{
 const result=normalise({version:1,id:'capture-2',times:[
 {epochMillis:Date.parse('2026-10-04T22:59:59.999Z'),offsetSeconds:3600},
 {epochMillis:Date.parse('2026-10-04T23:00:00.001Z'),offsetSeconds:3600}]});
 assert.equal(result.draft.startTime,'23:59');assert.equal(result.draft.timeOnSite,'00:00');
 assert.equal(result.local[1].slice(0,10),'2026-10-05');
});
test('rejects malformed and reversed capture data',()=>{
 const time={epochMillis:1791100000000,offsetSeconds:3600};
 for(const payload of [{version:2,id:'a',times:[time]},{version:1,id:'a',times:[]},
 {version:1,id:'a',times:[{...time,offsetSeconds:99999}]},
 {version:1,id:'a',times:[time,{...time,epochMillis:time.epochMillis-1}]}])assert.throws(()=>normalise(payload));
});
