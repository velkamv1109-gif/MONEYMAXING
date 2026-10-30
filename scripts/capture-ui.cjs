const {chromium}=require('playwright');const path=require('node:path');const fs=require('node:fs/promises');
(async()=>{
 const outputDir=process.env.MONEYMAXING_CAPTURE_DIR || path.resolve(__dirname,'../.test-data/capturas');await fs.mkdir(outputDir,{recursive:true});
 const b=await chromium.connectOverCDP('http://127.0.0.1:9226');const p=b.contexts()[0].pages()[0];
 if(await p.locator('#gate').isVisible()){await p.locator('#gate-password').fill('Prueba-local-2026!');await p.locator('#gate-submit').click();await p.locator('#app').waitFor({state:'visible'});}
 for(const [name,file] of [['home','resumen'],['transactions','movimientos'],['security','respaldos']]){
  await p.locator('[data-page='+name+']').click();await p.mouse.move(1200,20);
  await p.locator('.page.active').evaluate(async el=>await Promise.all(el.getAnimations().map(a=>a.finished)));
  await p.screenshot({path:path.join(outputDir,file+'-minimalista.png'),animations:'disabled'});
 }
 await p.locator('[data-page=home]').click();console.log('CAPTURAS_OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
