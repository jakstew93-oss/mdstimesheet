const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('every versioned local script and stylesheet in index.html is cached in sw.js and exists on disk',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 const refs=new Set([
  ...[...html.matchAll(/<script[^>]+src="([^"?]+\?v=\d+)"/g)].map(m=>m[1]),
  ...[...html.matchAll(/<link[^>]+href="([^"?]+\?v=\d+)"/g)].map(m=>m[1]),
 ]);
 assert.ok(refs.size>=15,'expected versioned assets in index.html');
 for(const ref of refs){
  const file=ref.split('?')[0];
  assert.ok(fs.existsSync(file),'missing file on disk: '+file);
  assert.ok(sw.includes('./'+ref),'sw.js APP_SHELL missing: ./'+ref);
 }
});

test('extracted bundled fonts and PDF templates exist on disk and are cached in sw.js',()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(!html.includes('__bundler/manifest'),'index.html should be unpacked');
 assert.ok(!html.includes('__bundler/template'),'index.html should be unpacked');
 for(const pdf of ['templates/timesheet-blank.pdf','templates/holiday-blank.pdf','templates/van-check-blank.pdf']){
  assert.ok(fs.existsSync(pdf),'missing '+pdf);
  assert.ok(sw.includes('./'+pdf),'sw.js missing ./'+pdf);
 }
 const fonts=fs.readdirSync('fonts/bundled').filter(f=>f.endsWith('.woff2'));
 assert.equal(fonts.length,13);
 for(const font of fonts){
  assert.ok(sw.includes('./fonts/bundled/'+font),'sw.js missing font '+font);
 }
});
