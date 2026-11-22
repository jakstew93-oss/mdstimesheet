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
  changelog:{id:'cl-1',title:'New in MDS Timesheet',items:['Faster avatar loading','New van added']},
 };
 const nextSource=admin.updateSiteConfigSource(original,nextCfg);
 assert.ok(nextSource.includes('"AB24 CDE"'));
 assert.ok(nextSource.includes('mileage:0.45'));
 assert.ok(nextSource.includes('"Bank holiday Friday"'));
 assert.ok(nextSource.includes('"Faster avatar loading"'));
 assert.doesNotThrow(()=>new Function(nextSource));
});

test('activeNotice respects expiry and dismissal',()=>{
 const cfg={notice:{id:'n-1',text:'Heads up',expires:'2026-11-30'}};
 assert.equal(siteConfig.activeNotice(cfg,'2026-11-21','').text,'Heads up');
 assert.equal(siteConfig.activeNotice(cfg,'2026-11-21','n-1'),null);
 assert.equal(siteConfig.activeNotice(cfg,'2026-12-01',''),null);
 assert.equal(siteConfig.activeNotice({notice:{id:'',text:'',expires:''}},'2026-11-21',''),null);
});

test('activeChangelog and draftChangelogFromChanges work cleanly',()=>{
 const cfg={changelog:{id:'cl-1',title:'Updates',items:['Faster load','New van']}};
 assert.deepEqual(siteConfig.activeChangelog(cfg,''),{id:'cl-1',title:'Updates',items:['Faster load','New van']});
 assert.equal(siteConfig.activeChangelog(cfg,'cl-1'),null);
 assert.equal(siteConfig.activeChangelog({changelog:{id:'',title:'',items:[]}},''),null);

 const baseRoster=[{name:'Jak Stewart',password:'js123'}];
 const nextRoster=[...baseRoster,{name:'Sam Taylor',password:'st456'}];
 const baseCfg={fleet:[['LD68 ULM','Jak’s Van']],features:{payEstimate:['Jak Stewart'],shiftDial:[],sundayReminder:[]},rates:{mileage:0.25,night:20,holidayHours:8,satX:1.5,sunX:1.5}};
 const nextCfg={fleet:[...baseCfg.fleet,['AB24 CDE','Sam’s Van']],features:{payEstimate:['Jak Stewart','Sam Taylor'],shiftDial:[],sundayReminder:[]},rates:{mileage:0.35,night:20,holidayHours:8,satX:1.5,sunX:1.5}};
 const notes=admin.draftChangelogFromChanges(baseRoster,nextRoster,baseCfg,nextCfg);
 assert.ok(notes.some(n=>n.includes('Sam Taylor')));
 assert.ok(notes.some(n=>n.includes('AB24 CDE')));
 assert.ok(notes.some(n=>n.includes('Pay Estimate')));
 assert.ok(notes.some(n=>n.includes('£0.35')));
 assert.equal(admin.formatSize(18*1024),'18 KB');
 assert.equal(admin.formatSize(1.5*1024*1024),'1.5 MB');
});

test('QR login hash round-trips and encodes a valid scannable QR matrix',()=>{
 const hash=siteConfig.encodeLoginHash('Sam Taylor','st482');
 assert.match(hash,/^#login=[A-Za-z0-9_-]+$/);
 assert.deepEqual(siteConfig.parseLoginHash(hash),{name:'Sam Taylor',password:'st482'});
 assert.equal(siteConfig.parseLoginHash('#login=not-valid-base64!!!'),null);
 assert.equal(siteConfig.parseLoginHash('#other=123'),null);

 const url=admin.loginUrl('Matthew Heath','mh123');
 assert.ok(url.startsWith(admin.APP_URL+'#login='));
 const mat=admin.encodeQR(url);
 assert.ok(Array.isArray(mat)&&mat.length>=21&&mat.length===mat[0].length);
 // Check top-left 7x7 finder border is dark
 for(let i=0;i<7;i++){assert.equal(mat[0][i],true);assert.equal(mat[6][i],true);assert.equal(mat[i][0],true);assert.equal(mat[i][6],true)}
});

test('publishSummary reports portraits, drivers, fleet, notices and changelog diffs',()=>{
 const baseRoster=[{name:'Jak Stewart',password:'js123'}];
 const nextRoster=[...baseRoster,{name:'Sam Taylor',password:'st456'}];
 const baseCfg={fleet:[['LD68 ULM','Jak’s Van']],features:{payEstimate:['Jak Stewart'],shiftDial:[],sundayReminder:[]},rates:{mileage:0.25,night:20,holidayHours:8,satX:1.5,sunX:1.5},notice:{id:'',text:'',expires:''},changelog:{id:'',title:'',items:[]}};
 const nextCfg={...baseCfg,fleet:[...baseCfg.fleet,['AB24 CDE','Sam’s Van']],changelog:{id:'cl-1',title:'Updates',items:['New van']}};
 const lines=admin.publishSummary(baseRoster,nextRoster,baseCfg,nextCfg,{'sam-taylor':'abc'});
 assert.ok(lines.some(l=>l.includes('1 portrait')));
 assert.ok(lines.some(l=>l.includes('+1 driver')));
 assert.ok(lines.some(l=>l.includes('Company fleet updated')));
 assert.ok(lines.some(l=>l.includes('What’s New updated')));
 assert.deepEqual(admin.publishSummary(baseRoster,baseRoster,baseCfg,baseCfg,{}),[]);
});

test('admin and site-config assets are loaded by index.html and cached offline',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 for(const ref of ['site-config.css?v=2','site-config.js?v=4','admin.css?v=5','admin.js?v=6']){
  assert.ok(html.includes(ref),'index.html missing '+ref);
  assert.ok(sw.includes('./'+ref),'sw.js missing ./'+ref);
 }
 assert.ok(html.indexOf('site-config.js?v=4')<html.indexOf('drivers.js?v=3'));
 assert.deepEqual(siteConfig.BASE_CONFIG.features.whatIfBreak,['Jak Stewart']);
 assert.deepEqual(siteConfig.BASE_CONFIG.features.splitDay,['Jak Stewart']);
});
