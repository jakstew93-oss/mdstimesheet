const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = process.cwd();
  const server = http.createServer((req,res) => {
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if (!file.startsWith(root+path.sep) && file!==root) {res.writeHead(403);res.end();return;}
    const dest=fs.statSync(file,{throwIfNoEntry:false})?.isDirectory() ? path.join(file,'index.html') : file;
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.pdf':'application/pdf'};
    if (!fs.existsSync(dest)) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',mime[path.extname(dest)]||'application/octet-stream');fs.createReadStream(dest).pipe(res);
  });
  await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765');
    await page.waitForSelector('#loginScreen .theme-picker');
    await page.locator('#loginScreen summary').click();
    await page.locator('#loginScreen [data-theme="timequest"]').click();
    await page.screenshot({path:'theme-screenshots/timequest-login.png',fullPage:true});
    await page.evaluate(()=>localStorage.setItem('ts_auth_user','Jak Stewart'));
    await page.reload();await page.waitForSelector('#qsJob');
    await page.locator('#qsJob').fill('TEST-1234');
    const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='mds_theme_preference')));
    for (const id of ['classic','midnight','graphite','light','arcade','timequest']) {
      await page.evaluate(id=>document.querySelector('body > .theme-picker [data-theme="'+id+'"]').click(),id);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.mdsTheme),id);
      assert.equal(await page.locator('#qsJob').inputValue(),'TEST-1234');
      assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='mds_theme_preference'))),snapshot);
    }
    await page.reload();await page.waitForSelector('#qsJob');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.mdsTheme),'timequest');
    for(const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>document.querySelector('body > .theme-picker [data-theme="classic"]').click());
      const base=await page.evaluate(()=>document.documentElement.scrollWidth);
      await page.evaluate(()=>document.querySelector('body > .theme-picker [data-theme="timequest"]').click());
      const themed=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(themed<=Math.max(base,width)+2,'TimeQuest overflow at '+width+': '+themed+' baseline '+base);
      await page.screenshot({path:'theme-screenshots/timequest-'+width+'.png',fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('body > .theme-picker summary').click();
    await page.screenshot({path:'theme-screenshots/timequest-details.png',fullPage:true});
    await page.locator('#qsJob').fill('88');
    await page.waitForSelector('.tq-notice.visible');
    assert.equal(await page.locator('#qsJob').inputValue(),'88');
    assert.match(await page.locator('.tq-notice').textContent(),/TEMPORAL DISPLACEMENT/);
    await page.evaluate(()=>document.querySelector('body > .theme-picker [data-theme="classic"]').click());
    await page.waitForFunction(()=>!document.querySelector('.tq-notice').classList.contains('visible'));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>document.querySelector('body > .theme-picker [data-theme="timequest"]').click());
    assert.equal(await page.locator('.tq-scanner b').last().evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('.timequest-crt').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    assert.deepEqual(errors,[],'Browser errors');
    console.log('PASS: six themes, storage preservation, reload, responsive widths, 88 Easter egg, cleanup, reduced motion and pointer-transparent CRT.');
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
