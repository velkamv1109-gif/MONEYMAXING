const {_electron}=require('playwright');const path=require('node:path');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.test-data/profile-review');await fs.mkdir(output,{recursive:true});
 const dataDir=path.join(root,'.test-data/profiles-'+Date.now());
 const launch=()=>_electron.launch({executablePath:process.env.MONEYMAXING_EXE||path.join(root,'release/win-unpacked/MONEYMAXING.exe'),env:{...process.env,MONEYMAXING_DATA_DIR:dataDir,MONEYMAXING_PORT:'0'},timeout:30000});
 let app=await launch(),p=await app.firstWindow();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const saved=()=>p.waitForFunction(()=>document.querySelector('#save-status').textContent==='Guardado'&&!document.body.hasAttribute('aria-busy'));
 const nav=async page=>{await p.locator('[data-page='+page+']').click();await saved();};
 const switchTo=async name=>{await p.locator('#profile-switcher-btn').click();await p.locator('#profile-choices button').filter({hasText:name}).click();await saved();};
 const themes=()=>p.locator('html').getAttribute('data-theme');
 const navItems=()=>p.locator('.nav-menu button:visible').evaluateAll(els=>els.map(e=>e.dataset.page));
 async function create(name,role,theme,currency='MXN'){
  await p.locator('.role-card[data-role='+role+']').click();await p.locator('#wizard-next-1').click();await p.locator('#wiz-profile-name').fill(name);await p.locator('#wiz-theme').selectOption(theme);await p.locator('#wiz-currency').selectOption(currency);await p.locator('#wizard-next-2').click();await p.locator('#wiz-business-name').fill(name+' Firma');await p.locator('#wizard-finish').click();await saved();await p.locator('#onboarding-modal').waitFor({state:'hidden'});
 }
 async function add(name,role,theme,currency){await nav('studio');await p.locator('#btn-add-profile-wizard').click();await create(name,role,theme,currency);}
 try{
  await p.locator('#gate-password').fill('Perfiles-prueba-2026!');await p.locator('#gate-confirm').fill('Perfiles-prueba-2026!');await p.locator('#gate-submit').click();await p.locator('#onboarding-modal').waitFor({state:'visible'});
  await create('Inmobiliaria prueba','realestate','gold','USD');
  assert(await p.locator('#page-realestate').isVisible());assert.deepEqual(await navItems(),['home','transactions','realestate','studio','security']);
  await p.locator('#input-re-price').fill('4500000');await p.locator('#input-re-price').dispatchEvent('input');await saved();
  await p.locator('#new-quotation-btn').click();assert.deepEqual(await p.locator('#quotation-dialog [name=type] option').evaluateAll(els=>els.map(e=>e.value)),['services','mortgage']);assert.equal(await p.locator('#quotation-dialog [name=business]').inputValue(),'Inmobiliaria prueba Firma');await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k');assert(!/Seguros|Contabilidad|Clientes/.test(await p.locator('#cmd-results-list').innerText()));await p.keyboard.press('Escape');
  await add('Seguros prueba','insurance','sapphire');assert(await p.locator('#page-insurance').isVisible());assert.deepEqual(await navItems(),['home','transactions','insurance','clients','studio','security']);
  await p.locator('#input-monthly-inv').fill('6500');await p.locator('#input-monthly-inv').dispatchEvent('input');await saved();
  await nav('studio');await p.locator('#setting-advisor-name').fill('Asesora seguros');await p.locator('#save-studio-btn').click();await saved();await nav('insurance');
  await switchTo('Inmobiliaria prueba');assert.equal(await themes(),'gold');assert.equal(await p.locator('#input-re-price').inputValue(),'4500000');
  await nav('realestate');await switchTo('Seguros prueba');assert(await p.locator('#page-insurance').isVisible());assert.equal(await themes(),'sapphire');assert.equal(await p.locator('#input-monthly-inv').inputValue(),'6500');
  await nav('studio');assert.equal(await p.locator('#setting-advisor-name').inputValue(),'Asesora seguros');assert.equal(await p.locator('#setting-currency').inputValue(),'MXN');
  await switchTo('Inmobiliaria prueba');assert(await p.locator('#page-realestate').isVisible());await nav('studio');assert.equal(await p.locator('#setting-advisor-name').inputValue(),'');assert.equal(await p.locator('#setting-currency').inputValue(),'USD');
  console.log('PASS isolated specialty navigation, commands, quotation types, branding, currency and simulator state');
  await add('Negocio prueba','accounting','titanium');assert.deepEqual(await navItems(),['home','transactions','accounting','budgets','studio','security']);
  await add('Personal prueba','personal','aero');assert.deepEqual(await navItems(),['home','transactions','budgets','studio','security']);
  await nav('studio');await p.locator('#setting-profile-role').selectOption('master');await p.locator('#save-studio-btn').click();await saved();assert.equal((await navItems()).length,9);
  const session=await p.context().newCDPSession(p);
  for(const theme of ['obsidian','gold','sapphire','titanium','amethyst','crimson','emerald-light','aero']){
   await p.locator('[data-theme-val='+theme+']').click();await saved();assert.equal(await themes(),theme);await nav('home');await p.screenshot({path:path.join(output,theme+'.png')});await nav('studio');
   const contrast=await p.evaluate(()=>{const css=getComputedStyle(document.documentElement);const rgb=s=>s.trim().replace('#','').match(/../g).map(x=>parseInt(x,16)/255);const L=s=>rgb(s).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const bg=L(css.getPropertyValue('--bg-app'));return ['--ink','--ink-secondary','--muted','--accent-base'].map(k=>{const l=L(css.getPropertyValue(k));return (Math.max(l,bg)+.05)/(Math.min(l,bg)+.05);});});assert(contrast.every(r=>r>=4.5),theme+' contrast '+contrast);
  }
  for(const width of [1280,900,720]){await session.send('Emulation.setDeviceMetricsOverride',{width,height:860,deviceScaleFactor:1,mobile:false});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await p.locator('.theme-picker-btn').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().right<=innerWidth)), 'theme controls clipped');assert(await p.locator('#lock-btn').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'topbar clipped');await p.screenshot({path:path.join(output,'preferencias-'+width+'.png'),fullPage:true});}
  await session.send('Emulation.clearDeviceMetricsOverride');console.log('PASS 8 themes, text contrast >=4.5 and responsive preferences');
  await p.route('**/api/vault',async route=>{if(route.request().method()==='PUT')await route.fulfill({status:503,contentType:'application/json',body:'{"error":"prueba"}'});else await route.continue();});
  await p.locator('[data-theme-val=crimson]').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('No guardado'));assert.equal(await themes(),'aero');await p.unroute('**/api/vault');console.log('PASS failed save restores committed appearance');
  await switchTo('Seguros prueba');await nav('insurance');await p.locator('#input-monthly-inv').fill('7000');await p.locator('#input-monthly-inv').dispatchEvent('input');await app.close();
  app=await launch();p=await app.firstWindow();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.locator('#gate-password').fill('Perfiles-prueba-2026!');await p.locator('#gate-submit').click();await p.locator('#app').waitFor({state:'visible'});
  assert.equal(await themes(),'sapphire');assert(await p.locator('#page-insurance').isVisible());assert.equal(await p.locator('#input-monthly-inv').inputValue(),'7000');await switchTo('Inmobiliaria prueba');assert.equal(await themes(),'gold');assert.equal(await p.locator('#input-re-price').inputValue(),'4500000');await nav('studio');assert.equal(await p.locator('#setting-business-name').inputValue(),'Inmobiliaria prueba Firma');
  assert.deepEqual(errors,[]);console.log('PASS profiles survive complete close and reopen');console.log('PROFILES_SMOKE_OK');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
