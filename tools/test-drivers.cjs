const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const drivers=require('../drivers.js');

test('driver roster is the single source of truth for names, passwords and portraits',()=>{
 assert.ok(drivers.names.includes('Jak Stewart'));
 assert.ok(drivers.names.includes('Michael Simpson'));
 assert.ok(drivers.names.includes('Luke Chambers'));
 assert.equal(drivers.passwords['Jak Stewart'],'js847');
 assert.equal(drivers.passwords['Michael Simpson'],'ms191');
 assert.equal(drivers.passwords['Luke Chambers'],undefined);
 for(const [name,file] of Object.entries(drivers.portraits)){
  assert.ok(drivers.names.includes(name),name+' portrait has no roster entry');
  assert.ok(fs.existsSync('driver-avatars/'+file+'.png'),'missing portrait for '+name);
 }
});

test('drivers.js is loaded before the main app and cached offline',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 assert.ok(html.includes('drivers.js?v=3'));
 assert.ok(html.indexOf('drivers.js?v=3')<html.indexOf('timesheet-tools.js?v=63'));
 assert.ok(sw.includes('./drivers.js?v=3'));
});
