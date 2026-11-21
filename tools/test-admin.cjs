const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const admin=require('../admin.js');
const drivers=require('../drivers.js');
const siteConfig=require('../site-config.js');

test('admin page is strictly limited to Jak Stewart',()=>{
 assert.equal(admin.isAdmin('Jak Stewart'),true);
 assert.equal(admin.isAdmin('Cody Slack'),false);
 assert.equal(admin.isAdmin('Martyn Evans'),false);
 assert.equal(admin.isAdmin(''),false);
 assert.equal(admin.isAdmin(null),false);
});

test('generatePassword, slugify and shareLoginText work cleanly',()=>{
 assert.match(admin.generatePassword('Sam Taylor'),/^st\d{3}$/);
 assert.match(admin.generatePassword('Oliver Spicer'),/^os\d{3}$/);
 assert.equal(admin.slugify('Sam Taylor'),'sam-taylor');
 const msg=admin.shareLoginText('Sam Taylor','st482');
 assert.match(msg,/https:\/\/jakstew93-oss\.github\.io\/mdstimesheet\//);
 assert.match(msg,/Name: Sam Taylor/);
 assert.match(msg,/Password: st482/);
});

test('updateDriversSource cleanly updates BASE_ROSTER and produces valid JavaScript',()=>{
 const original=fs.readFileSync('drivers.js','utf8');
 const updatedRoster=[...drivers.BASE_ROSTER,{name:'Sam Taylor',password:'st482',portrait:'sam-taylor'}];
 const nextSource=admin.updateDriversSource(original,updatedRoster);
 assert.ok(nextSource.includes('"Sam Taylor"'));
 assert.ok(nextSource.includes('"sam-taylor"'));
 assert.doesNotThrow(()=>new Function(nextSource));
});

test('updateSiteConfigSource cleanly updates BASE_CONFIG and produces valid JavaScript',()=>{
 const original=fs.readFileSync('site-config.js','utf8');
 const nextCfg={
  fleet:[...siteConfig.BASE_CONFIG.fleet,['AB24 CDE','New Van']],
  features:{...siteConfig.BASE_CONFIG.features,shiftDial:['Jak Stewart','Cody Slack']},
  rates:{mileage:0.45,night:25,holidayHours:8,satX:1.5,sunX:2},
  notice:{id:'n-1',text:'Bank holiday Friday',expires:'2026-12-31'},
 };
 const nextSource=admin.updateSiteConfigSource(original,nextCfg);
 assert.ok(nextSource.includes('"AB24 CDE"'));
 assert.ok(nextSource.includes('mileage:0.45'));
 assert.ok(nextSource.includes('"Bank holiday Friday"'));
 assert.doesNotThrow(()=>new Function(nextSource));
});

test('activeNotice respects expiry and dismissal',()=>{
 const cfg={notice:{id:'n-1',text:'Heads up',expires:'2026-11-30'}};
 assert.equal(siteConfig.activeNotice(cfg,'2026-11-21','').text,'Heads up');
 assert.equal(siteConfig.activeNotice(cfg,'2026-11-21','n-1'),null);
 assert.equal(siteConfig.activeNotice(cfg,'2026-12-01',''),null);
 assert.equal(siteConfig.activeNotice({notice:{id:'',text:'',expires:''}},'2026-11-21',''),null);
});

test('admin and site-config assets are loaded by index.html and cached offline',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 for(const ref of ['site-config.css?v=1','site-config.js?v=1','admin.css?v=2','admin.js?v=2']){
  assert.ok(html.includes(ref),'index.html missing '+ref);
  assert.ok(sw.includes('./'+ref),'sw.js missing ./'+ref);
 }
 assert.ok(html.indexOf('site-config.js?v=1')<html.indexOf('drivers.js?v=3'));
});
