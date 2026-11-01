const {_electron}=require('playwright');const path=require('node:path');const fs=require('node:fs/promises');const crypto=require('node:crypto');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'.test-data/profile-migration-'+Date.now());await fs.mkdir(dataDir,{recursive:true});
 const profile=(id,role)=>({id,name:id,role,currency:id==='Anterior A'?'USD':'MXN',initialBalance:500,transactions:[{id:'tx-'+id,kind:'income',amount:123.45,note:'Registro existente',date:'2026-10-30',category:'otros',taxKind:'none',taxAmount:0,createdAt:1}],budgets:{otros:300},savingsGoals:[],realEstateProperties:[],insuranceClients:[],receivables:[],payables:[]});
 const original={version:2,activeProfileId:'Anterior A',globalSettings:{theme:'amethyst',accent:'gold',businessName:'Membrete anterior',autoLockMinutes:15,soundEnabled:false},profiles:[profile('Anterior A','realestate'),profile('Anterior B','insurance')]};
 const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.pbkdf2Sync('Migracion-prueba-2026!',salt,310000,32,'sha256'),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(original)),cipher.final(),cipher.getAuthTag()]);
 await fs.writeFile(path.join(dataDir,'vault.enc.json'),JSON.stringify({revision:1,vault:{version:1,iterations:310000,salt:salt.toString('base64'),iv:iv.toString('base64'),ciphertext:encrypted.toString('base64')}}));
 const app=await _electron.launch({executablePath:process.env.MONEYMAXING_EXE||path.join(root,'release/win-unpacked/MONEYMAXING.exe'),env:{...process.env,MONEYMAXING_DATA_DIR:dataDir,MONEYMAXING_PORT:'0'}});
 let closed=false;try{
  const p=await app.firstWindow();p.setDefaultTimeout(15000);await p.locator('#gate-password').fill('Migracion-prueba-2026!');await p.locator('#gate-submit').click();await p.locator('#app').waitFor({state:'visible'});assert.equal(await p.locator('html').getAttribute('data-theme'),'amethyst');
  await p.locator('[data-page=home]').click();assert.match(await p.locator('#dash-balance').innerText(),/623\.45/);await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='Guardado');
  await p.locator('[data-page=studio]').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='Guardado');assert.equal(await p.locator('#setting-business-name').inputValue(),'Membrete anterior');
  await p.locator('[data-theme-val=gold]').click();await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='Guardado'&&!document.body.hasAttribute('aria-busy'));
  await p.locator('#profile-switcher-btn').click();await p.locator('#profile-choices button').filter({hasText:'Anterior B'}).click();await p.locator('#profile-dialog').waitFor({state:'hidden'});assert.equal(await p.locator('html').getAttribute('data-theme'),'amethyst');
  await app.close();closed=true;
  const saved=JSON.parse(await fs.readFile(path.join(dataDir,'vault.enc.json'),'utf8')).vault,bytes=Buffer.from(saved.ciphertext,'base64'),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(saved.iv,'base64'));decipher.setAuthTag(bytes.subarray(-16));const result=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0,-16)),decipher.final()]).toString());
  for(let i=0;i<2;i++){assert.deepEqual(result.profiles[i].transactions,original.profiles[i].transactions);assert.deepEqual(result.profiles[i].budgets,original.profiles[i].budgets);assert.equal(result.profiles[i].currency,original.profiles[i].currency);assert.equal(result.profiles[i].initialBalance,500);}
  assert.equal(result.profiles[0].settings.theme,'gold');assert.equal(result.profiles[1].settings.theme,'amethyst');console.log('LEGACY_PROFILE_MIGRATION_OK financial records unchanged; per-profile settings persisted in encrypted vault');
 }finally{if(!closed)await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
