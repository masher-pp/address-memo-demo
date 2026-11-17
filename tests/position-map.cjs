const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.DEMO_URL||'http://127.0.0.1:8011/';

(async()=>{
 const browser=await chromium.launch(process.env.CI?{headless:true}:{channel:'msedge',headless:true});
 try{
  for(const device of ['Pixel 7','iPhone 13']){
  const context=await browser.newContext({...devices[device],permissions:['geolocation'],geolocation:{latitude:31.301,longitude:120.701}});
  const page=await context.newPage();
  // Deterministic map imagery isolates picker interaction from tile-server availability.
  await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64')}));
  await page.goto(base);
  await page.locator('[data-action="add-place"]').click();
  await page.evaluate(()=>window.__originalPicker=document.querySelector('#position-picker'));
  await page.locator('[data-field="enterprise"]').fill('地图回归测试工厂');
  await page.locator('[data-field="name"]').fill('东门');
  await page.locator('[data-field="address"]').fill('苏州市测试路1号');
  await page.locator('[data-pos="locate"]').click();
  await page.locator('.position-coordinate').getByText('31.301000',{exact:false}).waitFor();
  assert.ok(await page.evaluate(()=>window.__originalPicker===document.querySelector('#position-picker')),'GPS must update the existing map instead of replacing it');
  await page.locator('#position-picker').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#position-picker .leaflet-tile-loaded'));
  const mapBounds=await page.locator('#position-picker').boundingBox();
  const gpsMarker=await page.locator('#position-picker .leaflet-marker-icon').boundingBox();
  assert.ok(Math.abs(gpsMarker.x+13-(mapBounds.x+mapBounds.width/2))<2&&Math.abs(gpsMarker.y+32-(mapBounds.y+mapBounds.height/2))<2,'GPS marker must be centered in the map');
  const before=await page.locator('.position-coordinate').innerText();
  await page.locator('#position-picker').tap({position:{x:65,y:65}});
  await page.waitForFunction(value=>document.querySelector('.position-coordinate').textContent!==value,before);
  assert.ok(await page.evaluate(()=>window.__originalPicker===document.querySelector('#position-picker')),'Picking must preserve map and zoom');
  const picked=await page.locator('.position-coordinate').innerText();
  const marker=page.locator('#position-picker .leaflet-marker-icon');
  const bounds=await marker.boundingBox();
  await page.mouse.move(bounds.x+12,bounds.y+12);
  await page.mouse.down();
  await page.mouse.move(bounds.x+55,bounds.y+35,{steps:6});
  await page.mouse.up();
  await page.waitForFunction(value=>document.querySelector('.position-coordinate').textContent!==value,picked);
  const adjusted=await page.locator('.position-coordinate').innerText();
  await page.locator('[data-pos="save"]').click();
  await page.reload();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('address-memo-user-v2')).places.find(p=>p.enterprise==='地图回归测试工厂'));
  assert.equal(saved.coordSystem,'wgs84');
  assert.ok(adjusted.includes(saved.lat.toFixed(6))&&adjusted.includes(saved.lng.toFixed(6)));
  assert.equal(saved.address,'苏州市测试路1号');
  console.log(`PASS ${device}: GPS recenters map, touch selection and marker dragging preserve map, coordinates and address persist`);
  await context.close();
  }
  const fallback=await browser.newContext({...devices['Pixel 7']});
  const page=await fallback.newPage();
  await page.route('https://tile.openstreetmap.org/**',r=>r.abort('failed'));
  await page.goto(base);
  await page.locator('[data-action="add-place"]').click();
  await page.locator('[data-field="enterprise"]').fill('拒绝权限测试工厂');
  await page.locator('[data-field="name"]').fill('东门');
  await page.locator('[data-field="address"]').fill('苏州市测试路2号');
  await page.evaluate(()=>{
    navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail({code:1});
  });
  await page.locator('[data-pos="locate"]').click();
  assert.match(await page.locator('.position-error').innerText(),/定位权限未开启/);
  await page.waitForFunction(()=>[...document.querySelectorAll('#position-picker .leaflet-tile')].some(i=>i.src.includes('arcgisonline.com')&&i.complete&&i.naturalWidth>0),null,{timeout:25000});
  assert.doesNotMatch(await page.locator('#position-picker .leaflet-control-attribution').innerText(),/OpenStreetMap/);
  await page.locator('#position-picker').scrollIntoViewIfNeeded();
  await page.locator('#position-picker').tap({position:{x:70,y:70}});
  await page.locator('.position-coordinate').waitFor();
  require('node:fs').mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/position-map-live.png'});
  await page.locator('[data-pos="save"]').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('address-memo-user-v2')).places.find(p=>p.enterprise==='拒绝权限测试工厂'));
  assert.ok(Number.isFinite(saved.lat)&&Number.isFinite(saved.lng));
  console.log('PASS primary tiles unavailable: actual backup tiles load; location denied: manual map selection and save work');
  await page.locator('[data-action="add-place"]').click();
  await page.locator('[data-field="enterprise"]').fill('超时后保留内容');
  await page.evaluate(()=>navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail({code:3}));
  await page.locator('[data-pos="locate"]').click();
  assert.match(await page.locator('.position-error').innerText(),/定位超时/);
  assert.equal(await page.locator('[data-field="enterprise"]').inputValue(),'超时后保留内容');
  assert.equal(await page.locator('[data-pos="locate"]').isEnabled(),true);
  await page.evaluate(()=>navigator.geolocation.getCurrentPosition=ok=>window.__pendingGPS=ok);
  await page.locator('[data-pos="locate"]').click();
  await page.locator('[data-pos="close"]').click();
  await page.locator('[data-pos="discard"]').click();
  await page.evaluate(()=>window.__pendingGPS({coords:{latitude:31.4,longitude:120.8,accuracy:10}}));
  assert.equal(await page.locator('#position-dialog').isVisible(),false);
  console.log('PASS location timeout preserves input and retry; closing editor ignores a late GPS callback');
  await fallback.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
