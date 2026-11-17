const {chromium, devices} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.DEMO_URL || 'http://127.0.0.1:8011/';
const out = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(out, {recursive:true});

(async () => {
  const browser = await chromium.launch(process.env.CI ? {headless:true} : {headless:true, channel:'msedge'});
  try {
    for (const device of ['iPhone 13', 'Pixel 7']) {
      const context = await browser.newContext({...devices[device], permissions:['geolocation'], geolocation:{latitude:31.301,longitude:120.701}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, {waitUntil:'domcontentloaded'});
      await page.locator('[data-action="detail"][data-id="sz-higer-suhong"]').first().waitFor();
      assert.doesNotMatch(await page.locator('body').innerText(), /官网公开定位/);
      await page.screenshot({path:path.join(out, `${device}-home.png`)});

      await page.locator('[data-action="detail"][data-id="sz-higer-suhong"]').first().click();
      assert.doesNotMatch(await page.locator('#arrival-dialog').innerText(), /官网|公开定位|查看来源/);
      await page.locator('[data-ag="navigate"]').click();
      const nativeLinks = page.locator('.provider-app');
      assert.equal(await nativeLinks.count(), 2);
      for (const href of await nativeLinks.evaluateAll(nodes => nodes.map(a => a.getAttribute('href')))) {
        assert.match(href, /^(iosamap|amapuri|baidumap|bdapp):\/\//);
        assert.doesNotMatch(href, /^https?:/);
      }
      assert.equal(await page.locator('[data-action="provider-web"], .navigation-fallback, .external-map-link').count(), 0);
      await page.screenshot({path:path.join(out, `${device}-navigation.png`)});
      // A desktop browser cannot launch a phone App. Preserve a real user click,
      // prevent only the OS handoff and verify our blocked-launch notice.
      await page.evaluate(() => document.addEventListener('click', event => {
        if (event.target.closest('.provider-app')) event.preventDefault();
      }, {capture:true}));
      await page.evaluate(() => document.addEventListener('click', event => {
        if (event.target.closest('.provider-app')) window.dispatchEvent(new PageTransitionEvent('pagehide'));
      }));
      await nativeLinks.first().click();
      await page.locator('#provider-result').getByText('允许浏览器打开外部应用', {exact:false}).waitFor();
      await page.locator('[data-action="close-modal"]').click();

      await page.locator('#user-search').fill('海格');
      await page.locator('[data-action="route-add"]').first().click();
      await page.locator('[data-page="route"]').click();
      const tabBounds = await page.locator('.user-tabbar').boundingBox();
      assert.ok(Math.abs(tabBounds.y + tabBounds.height - page.viewportSize().height) < 2);
      await page.locator('[data-action="route-navigate"]').click();
      assert.equal(await nativeLinks.count(), 2);
      await page.locator('[data-action="close-modal"]').click();
      await page.screenshot({path:path.join(out, `${device}-visits.png`)});
      await page.locator('[data-action="route-complete"]').click();
      assert.match(await page.locator('#user-content').innerText(), /本次走访已完成/);

      await page.locator('[data-page="home"]').click();
      await page.locator('[data-action="detail"][data-id="sz-higer-suhong"]').first().click();
      await page.locator('[data-ag="feedback"]').click();
      await page.locator('[data-ag-field="description"]').first().fill('从东门进入，沿主路直行至接待处。');
      const photo = await page.evaluate(() => {
        const canvas=document.createElement('canvas'); canvas.width=640;canvas.height=480;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#e3eaf0';ctx.fillRect(0,0,640,480);
        ctx.fillStyle='#5b7294';ctx.fillRect(220,180,200,300);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await page.locator('[data-ag="photo-file"]').first().setInputFiles({name:'entrance.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
      await page.locator('[data-ag="annotate"]').first().waitFor();
      await page.locator('[data-ag="annotate"]').first().click();
      await page.locator('#ag-mark-canvas').waitFor();
      await page.waitForFunction(() => document.querySelector('#ag-mark-canvas')?.width===640);
      const canvasBounds = await page.locator('#ag-mark-canvas').boundingBox();
      await page.mouse.move(canvasBounds.x+40, canvasBounds.y+40);
      await page.mouse.down();
      await page.mouse.move(canvasBounds.x+150, canvasBounds.y+100);
      await page.mouse.up();
      await page.locator('[data-ag="mark-done"]').click();
      await page.locator('[data-ag="add-step"]').click();
      await page.locator('[data-ag-field="description"]').nth(1).fill('接待处右转，一层 101 室。');
      await page.locator('[data-ag="preview"]').click();
      assert.match(await page.locator('#arrival-dialog').innerText(), /一层 101 室/);
      await page.locator('[data-ag="return-edit"]').click();
      await page.locator('[data-ag="save"]').click();
      await page.locator('.ag-timeline').waitFor();
      await page.locator('[data-ag="photo-view"]').first().click();
      await page.locator('#ag-lightbox-canvas').waitFor();
      await page.locator('[data-ag="back"]').click();
      assert.match(await page.locator('#arrival-dialog').innerText(), /从东门进入/);
      await page.locator('[data-ag="more"]').click();
      await page.locator('[data-action="menu-info"]').click();
      assert.doesNotMatch(await page.locator('#user-modal-body').innerText(), /官网|原始坐标|查看来源/);
      await page.locator('[data-action="info-edit"]').click();
      await page.locator('[name="contact"]').fill('现场联系人');
      await page.locator('[name="phone"]').fill('13800138000');
      await page.locator('[name="tags"]').first().check();
      await page.locator('#place-info-form [type="submit"]').click();
      await page.locator('[data-action="comment-write"]').click();
      await page.locator('[name="comment"]').fill('请从东门到访。');
      await page.locator('#comment-form [type="submit"]').click();
      assert.match(await page.locator('#user-modal-body').innerText(), /请从东门到访/);
      await page.locator('[data-action="close-modal"]').click();
      await page.locator('#arrival-dialog [data-ag="back"]').click();

      await page.locator('[data-page="mine"]').click();
      await page.locator('[data-action="my-records"]').click();
      assert.match(await page.locator('#user-content').innerText(), /从东门进入/);
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('[data-page="mine"]').click();
      await page.locator('[data-action="my-records"]').click();
      assert.match(await page.locator('#user-content').innerText(), /从东门进入/);

      await page.locator('[data-page="home"]').click();
      await page.locator('[data-action="add-place"]').click();
      await page.locator('[data-field="enterprise"]').fill('现场新厂区');
      await page.locator('[data-field="name"]').fill('东门');
      await page.locator('[data-field="address"]').fill('苏州市测试路 101 号');
      await page.locator('[data-pos="locate"]').click();
      await page.locator('.position-coordinate').getByText('31.301000', {exact:false}).waitFor();
      await page.locator('[data-pos="save"]').click();
      await page.locator('#user-search').fill('现场新厂区');
      await page.locator('[data-action="detail"]').first().click();
      await page.locator('#arrival-dialog').waitFor();
      await page.locator('[data-ag="navigate"]').click();
      assert.equal(await nativeLinks.count(), 2);
      const destination=await page.evaluate(()=>{
        const saved=JSON.parse(localStorage.getItem('address-memo-user-v2')).places.find(p=>p.enterprise==='现场新厂区');
        return UserData.toGcj02(saved);
      });
      const params=new URL(await nativeLinks.first().getAttribute('href')).searchParams;
      assert.equal(params.get('dlat'),destination.lat.toFixed(6));
      assert.equal(params.get('dlon'),destination.lng.toFixed(6));
      assert.deepEqual(errors, []);
      console.log(`PASS ${device}: search, native-link parameters, blocked-launch notice, visits, guide editing, contacts, tags, comments, persistence and GPS capture`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
