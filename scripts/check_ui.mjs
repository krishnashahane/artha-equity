/** Optional real-browser QA; Playwright is a developer tool, never an app dependency.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check_ui.mjs
 * Start npm start first; ARTHA_URL defaults to http://127.0.0.1:3000.
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw new Error('Set PLAYWRIGHT_MODULE to your development-only Playwright installation.');
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const origin=process.env.ARTHA_URL??'http://127.0.0.1:3000';
try{
  for(const width of [768,1024,1440]){
    const page=await browser.newPage({viewport:{width,height:1024},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForSelector('#company-select');
    await page.waitForFunction(()=>document.querySelector('#main')?.getAttribute('aria-busy')==='false');
    await page.locator('.nav-link[href="#valuation"]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px document overflow`);
    await page.locator('[data-action="assumptions"]').click();
    assert.equal(await page.locator('#app').evaluate(node=>node.inert),true);
    await page.locator('.modal-header button').focus();await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('form')),'assumptions-form');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-close-dialog')),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('.modal').count(),0);
    assert.equal(await page.locator('#app').evaluate(node=>node.inert),false);
    await page.locator('[data-action="theme"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('[data-action="monte-carlo"]').click();await page.locator('#field-iterations').fill('100');
    await page.locator('[form="study-form"]').click();await page.waitForSelector('#study-result table');
    await page.keyboard.press('Escape');await page.locator('[data-action="reverse-dcf"]').click();
    await page.locator('#field-price').fill('1000');await page.locator('[form="study-form"]').click();
    await page.waitForFunction(()=>document.querySelector('#study-result')?.textContent.includes('Implied annual growth'));
    assert.deepEqual(errors,[]);console.log(`Browser ${width}px: PASS (layout, keyboard, theme, studies)`);await page.close();
  }
}finally{await browser.close();}
