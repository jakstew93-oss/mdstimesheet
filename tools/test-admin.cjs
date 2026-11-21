const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const admin=require('../admin.js');
const drivers=require('../drivers.js');

test('admin page is strictly limited to Jak Stewart',()=>{
 assert.equal(admin.isAdmin('Jak Stewart'),true);
 assert.equal(admin.isAdmin('Cody Slack'),false);
 assert.equal(admin.isAdmin('Martyn Evans'),false);
 assert.equal(admin.isAdmin(''),false);
 assert.equal(admin.isAdmin(null),false);
});

test('generatePassword produces initials plus three digits',()=>{
 assert.match(admin.generatePassword('Sam Taylor'),/^st\d{3}$/);
 assert.match(admin.generatePassword('Oliver Spicer'),/^os\d{3}$/);
 assert.match(admin.generatePassword('Alex'),/^al\d{3}$/);
});

test('updateDriversSource cleanly updates BASE_ROSTER and produces valid JavaScript',()=>{
 const original=fs.readFileSync('drivers.js','utf8');
 const updatedRoster=[...drivers.BASE_ROSTER,{name:'Sam Taylor',password:'st482'}];
 const nextSource=admin.updateDriversSource(original,updatedRoster);
 assert.ok(nextSource.includes('"Sam Taylor"'));
 assert.ok(nextSource.includes('"st482"'));
 assert.doesNotThrow(()=>new Function(nextSource));
});

test('admin assets are loaded by index.html and cached offline',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 assert.ok(html.includes('admin.css?v=1'));
 assert.ok(html.includes('admin.js?v=1'));
 assert.ok(sw.includes('./admin.css?v=1'));
 assert.ok(sw.includes('./admin.js?v=1'));
});
