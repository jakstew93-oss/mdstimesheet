const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('Index.html is a small page that forwards old links to the main app',()=>{
 const page=fs.readFileSync('Index.html','utf8');
 assert.ok(page.length<2000,'Index.html should not be a second copy of the app');
 assert.ok(page.includes("location.replace('./' + location.search + location.hash)"));
 assert.match(page,/http-equiv="refresh" content="0; url=\.\/"/);
 assert.ok(fs.readFileSync('sw.js','utf8').includes("'./Index.html'"),'old address still works offline');
});
