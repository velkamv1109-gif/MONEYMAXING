// Interactive QA: choose an isolated PDF destination in the native Windows dialog.
const {_electron}=require('playwright');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const app=await _electron.launch({executablePath:process.env.MONEYMAXING_EXE||path.join(root,'release/win-unpacked/MONEYMAXING.exe'),env:{...process.env,MONEYMAXING_DATA_DIR:path.join(root,'.test-data/native-'+Date.now()),MONEYMAXING_PORT:'0'},timeout:30000});
 try{
  const p=await app.firstWindow();p.setDefaultTimeout(15000);
  await p.locator('#gate-password').fill('Prueba-PDF-local-2026!');await p.locator('#gate-confirm').fill('Prueba-PDF-local-2026!');await p.locator('#gate-submit').click();await p.locator('#app').waitFor({state:'visible'});await p.locator('#close-wizard-btn').click();
  await p.locator('#new-quotation-btn').click();const q=p.locator('#quotation-dialog');
  await q.locator('[name=customer]').fill('Cliente de prueba');await q.locator('[name=business]').fill('Despacho de prueba');await q.locator('[name=number]').fill('PRUEBA-NATIVA');
  await q.locator('[data-description]').fill('Servicio de prueba');await q.locator('[data-price]').fill('100');await q.locator('button[type=submit]').click();
  await q.evaluate(el=>{el.scrollTop=0;});await p.screenshot({path:path.join(root,'.test-data/cotizacion-vista-previa.png')});
  await q.locator('#quotation-save').click();console.log('NATIVE_DIALOG_READY');
  await q.locator('#quotation-status').filter({hasText:'PDF guardado en:'}).waitFor({timeout:240000});
  const status=await q.locator('#quotation-status').innerText();const file=status.split('PDF guardado en:')[1].trim();
  const bytes=await fs.readFile(file);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');console.log('NATIVE_SAVE_OK '+file);
 } finally{await app.close();}
})().catch(error=>{console.error(error);process.exit(1);});
