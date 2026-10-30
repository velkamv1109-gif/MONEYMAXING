const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const password='Prueba-local-2026!'; // Isolated test fixture, never a user credential.
(async()=>{
  const browser=await chromium.connectOverCDP(process.env.MONEYMAXING_CDP || 'http://127.0.0.1:9226');
  const page=browser.contexts()[0].pages()[0]; page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.bringToFront();
  const checkpoint=message=>console.log('PASS '+message);
  const click=selector=>page.locator(selector).click();
  const waitSaved=()=>page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Guardado');
  await page.locator('#gate-password').fill(password);
  const creating=await page.locator('#gate-confirm').isVisible();
  if(creating) await page.locator('#gate-confirm').fill(password);
  await click('#gate-submit');
  await page.locator('#app').waitFor({state:'visible'});
  if(creating) {
    await click('#wizard-next-1'); await page.locator('#wiz-profile-name').fill('Verificación local'); await click('#wizard-next-2'); await click('#wizard-finish'); await waitSaved();
  }
  checkpoint('crear/abrir bóveda y configurar perfil');
  const addTx=async(kind,amount,note)=>{
    await click('#quick-add-btn');await page.locator('#modal-tx-kind').selectOption(kind);
    await page.locator('#modal-tx-amount').fill(amount);await page.locator('#modal-tx-note').fill(note);
    await click('#tx-form button[type=submit]'); await page.locator('#tx-modal').waitFor({state:'hidden'});await waitSaved();
  };
  await addTx('income','1000.10','Ingreso de prueba');await addTx('expense','0.10','Gasto de prueba');
  assert.match(await page.locator('#dash-balance').innerText(),/1,000\.00/);
  checkpoint('ingreso, gasto y total decimal conocido');
  await click('[data-page=transactions]');
  await page.locator('#full-tx-list .tx-item').filter({hasText:'Gasto de prueba'}).locator('.edit-tx-btn').click();
  await page.locator('#modal-tx-amount').fill('0.20');await click('#tx-form button[type=submit]');await waitSaved();
  assert.match(await page.locator('#dash-balance').innerText(),/999\.90/);
  checkpoint('editar movimiento recalcula total');
  // An offline write must not silently remain in the model or duplicate on retry.
  await click('#quick-add-btn');await page.locator('#modal-tx-amount').fill('12.34');await page.locator('#modal-tx-note').fill('Reintento único');
  await page.route('**/api/vault',route=>route.request().method()==='PUT' ? route.abort() : route.continue());
  await click('#tx-form button[type=submit]');await page.locator('#modal-tx-error').filter({hasText:/fetch|guardar|conexión/i}).waitFor();
  await page.unroute('**/api/vault');
  await click('#tx-form button[type=submit]');await page.locator('#tx-modal').waitFor({state:'hidden'});
  assert.equal(await page.locator('#full-tx-list .tx-item').filter({hasText:'Reintento único'}).count(),1);
  checkpoint('fallo de red, recuperación y reintento sin duplicado');
  await click('[data-page=budgets]');await click('#new-goal-btn');
  await page.locator('#edit-name').fill('Reserva de prueba');await page.locator('#edit-target').fill('10000');await page.locator('#edit-current').fill('100');
  await click('#editor-form button[type=submit]');await waitSaved();
  await click('.edit-goal-btn');await page.locator('#edit-current').fill('250');await click('#editor-form button[type=submit]');await waitSaved();
  assert.match(await page.locator('#savings-goals-container').innerText(),/250\.00/);
  checkpoint('crear y actualizar ahorro de meta');
  await click('[data-page=clients]');
  const addClient=async name=>{await click('#new-client-btn');await page.locator('#client-name').fill(name);await page.locator('#client-plan').fill('Plan registrado por usuario');await click('#client-form button[type=submit]');await page.locator('#client-modal').waitFor({state:'hidden'});};
  await addClient('Cliente A de prueba');await addClient('Cliente B de prueba');
  await page.locator('#client-search').fill('Cliente B');await click('.print-client-prop-btn');
  assert.equal(await page.locator('#prop-client-name').innerText(),'Cliente B de prueba');
  await click('#close-proposal-btn');await click('[data-page=clients]');await click('.delete-client-btn');await waitSaved();await page.locator('#client-search').fill('');
  assert.match(await page.locator('#clients-table-body').innerText(),/Cliente A/);assert.doesNotMatch(await page.locator('#clients-table-body').innerText(),/Cliente B/);
  checkpoint('acciones CRM sobre el cliente filtrado correcto');
  await click('[data-page=accounting]');await page.locator('#be-price').fill('10');await page.locator('#be-cost').fill('12');
  assert.equal(await page.locator('#be-units-res').innerText(),'Sin punto de equilibrio');
  checkpoint('calculadora sin margen no inventa equilibrio');
  for(const name of ['home','transactions','realestate','accounting','insurance','clients','budgets','studio','security']) {
    await click('[data-page='+name+']');assert(await page.locator('#page-'+name).isVisible());
  }
  checkpoint('nueve módulos y navegación');
  await click('#lock-btn');await page.locator('#gate-password').fill('incorrecta');await click('#gate-submit');
  await page.locator('#gate-error').filter({hasText:/incorrecta/}).waitFor();await page.locator('#gate-password').fill(password);await click('#gate-submit');await page.locator('#app').waitFor({state:'visible'});
  await click('[data-page=transactions]');assert.equal(await page.locator('#full-tx-list .tx-item').count(),3);
  checkpoint('contraseña incorrecta y persistencia tras bloquear/abrir');
  assert.deepEqual(errors,[]);checkpoint('sin errores JavaScript no capturados');
  console.log('UI_SMOKE_OK');
  // Disconnect without closing the real Windows app; screenshots are captured with Windows Graphics Capture.
  process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
