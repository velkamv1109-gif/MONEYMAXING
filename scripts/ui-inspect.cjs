const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9226');const p=b.contexts()[0].pages()[0];p.setDefaultTimeout(10000);
 if(await p.locator('#gate').isVisible()){await p.locator('#gate-password').fill('Prueba-local-2026!');await p.locator('#gate-submit').click();await p.locator('#app').waitFor({state:'visible'});}
 await p.locator('[data-page=transactions]').click();assert.equal(await p.locator('#full-tx-list .tx-item').count(),4);console.log('PASS persistencia tras cerrar y reabrir el proceso');
 await p.locator('[data-page=home]').click();
 const client=await p.context().newCDPSession(p);
 for(const width of [1280,900,720]){
  await client.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
  for(const name of ['home','transactions','realestate','accounting','insurance','clients','budgets','studio','security']){
   await p.locator('[data-page='+name+']').click();
   const sizes=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(sizes.scroll<=sizes.width+1,`${name} ${width}: horizontal overflow ${JSON.stringify(sizes)}`);
  }
  console.log('PASS nueve módulos sin desbordamiento horizontal a '+width+'px');
 }
 await client.send('Emulation.clearDeviceMetricsOverride');
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-page=home]').click();
 await p.locator('#quick-add-btn').click();await p.locator('#tx-form button[type=submit]').focus();await p.keyboard.press('Tab');
 assert.equal(await p.evaluate(()=>document.activeElement.id),'close-tx-modal-btn');
 await p.keyboard.press('Escape');await p.locator('#tx-modal').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>document.activeElement.id),'quick-add-btn');console.log('PASS foco atrapado, cierre y retorno al botón con teclado; movimiento reducido');
 console.log('UI_INSPECT_OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
