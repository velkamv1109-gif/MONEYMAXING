const { _electron } = require('playwright');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const exe=process.env.MONEYMAXING_EXE || path.resolve(__dirname,'../release/win-unpacked/MONEYMAXING.exe');
 const dataDir=path.resolve(__dirname,'../.test-data/packaged-'+Date.now());await fs.mkdir(dataDir,{recursive:true});
 const env={...process.env,MONEYMAXING_DATA_DIR:dataDir,MONEYMAXING_PORT:'0'};
 const launch=()=>_electron.launch({executablePath:exe,env,timeout:30000});
 let app=await launch();let page=await app.firstWindow();page.setDefaultTimeout(10000);
 const info=await app.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion(),dataDir:app.getPath('userData')}));
 assert.equal(info.packaged,true);assert.equal(info.dataDir,dataDir);console.log('PASS packaged runtime '+info.version);
 await page.locator('#gate-password').fill('Prueba-paquete-2026!');await page.locator('#gate-confirm').fill('Prueba-paquete-2026!');await page.locator('#gate-submit').click();
 await page.locator('#app').waitFor({state:'visible'});await page.locator('#close-wizard-btn').click();
 await page.locator('#quick-add-btn').click();await page.locator('#modal-tx-kind').selectOption('income');await page.locator('#modal-tx-amount').fill('321.45');await page.locator('#modal-tx-note').fill('Persistencia del paquete');
 await page.locator('#tx-form button[type=submit]').click();await page.locator('#tx-modal').waitFor({state:'hidden'});assert.match(await page.locator('#dash-balance').innerText(),/321\.45/);
 console.log('PASS packaged create and save');await app.close();
 app=await launch();page=await app.firstWindow();await page.locator('#gate-password').fill('Prueba-paquete-2026!');await page.locator('#gate-submit').click();await page.locator('#app').waitFor({state:'visible'});
 assert.match(await page.locator('#dash-balance').innerText(),/321\.45/);assert.match(await page.locator('#home-tx-list').innerText(),/Persistencia del paquete/);
 console.log('PASS packaged close/reopen persistence');
 const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(sizes.scroll<=sizes.width+1);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const name of ['home','transactions','realestate','accounting','insurance','clients','budgets','studio','security']){await page.locator('[data-page='+name+']').click();assert(await page.locator('#page-'+name).isVisible());}
 assert.deepEqual(errors,[]);console.log('PASS packaged navigation without page errors');
 await app.close();console.log('PACKAGED_SMOKE_OK');
})().catch(e=>{console.error(e);process.exit(1)});
