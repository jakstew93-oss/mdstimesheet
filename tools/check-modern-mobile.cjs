const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless: true});
  fs.mkdirSync('screenshots', {recursive:true});
  for (const width of [360, 390, 768, 1280]) {
    const context = await browser.newContext({viewport:{width,height:900}, serviceWorkers:'block'});
    await context.addInitScript(() => {
      // Isolated local browser fixture; never touches a live user session.
      localStorage.setItem('ts_auth_user','Jak Stewart');
      localStorage.setItem('timesheet_employee','Jak Stewart');
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8765');
    await page.locator('#qsJob').waitFor();
    await page.locator('#weekEndingMirror').fill('2026-09-20');
    await page.locator('#weekEndingMirror').dispatchEvent('change');
    await page.locator('#qsDate').fill('2026-09-18');
    await page.locator('#qsJob').fill('2048');
    for (const [field,value] of Object.entries({startTime:'07:00',timeOnSite:'08:00',timeOffSite:'16:00',endTime:'17:00'})) {
      const input=page.locator(`.qs-stage-input[data-field="${field}"]`);
      await input.fill(value);
      await input.dispatchEvent('change');
    }
    await page.locator('#qsSaveBtn').click();
    await page.locator('.entry-v2').waitFor();
    assert.match(await page.locator('.entry-v2').first().innerText(), /2048/);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,`Horizontal overflow at ${width}`);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`screenshots/log-${width}.png`,fullPage:true});
    for (const tab of ['Breaks','Preview','Export','Log']) {
      await page.locator('#ts-tabs').getByRole('button',{name:tab,exact:true}).click();
      assert.ok(await page.locator('.page.active').isVisible());
    }
    await page.locator('#sectionSelect').selectOption('van');
    await page.screenshot({path:`screenshots/vehicle-${width}.png`,fullPage:true});
    await page.locator('#sectionSelect').selectOption('holiday');
    await page.screenshot({path:`screenshots/holiday-${width}.png`,fullPage:true});
    await context.close();
  }
  await browser.close();
  console.log('Save-entry, navigation and responsive layout checks passed at four widths.');
})().catch(e=>{console.error(e);process.exit(1)});
