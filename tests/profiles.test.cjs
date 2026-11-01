const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../profile-core.cjs');
test('legacy global appearance becomes independent copies without changing financial records',()=>{
 const records=[{id:'existing',amount:123.45}];
 const vault={globalSettings:{theme:'gold',businessName:'Firma existente',autoLockMinutes:15},profiles:[{id:'a',role:'realestate',currency:'USD',transactions:records},{id:'b',role:'insurance',currency:'MXN',transactions:[]}]};
 const original=JSON.stringify(records);P.migrate(vault);
 vault.profiles[0].settings.theme='aero';vault.profiles[0].settings.businessName='Otra firma';
 assert.equal(vault.profiles[1].settings.theme,'gold');assert.equal(vault.profiles[1].settings.businessName,'Firma existente');assert.equal(vault.globalSettings.theme,'gold');assert.equal(JSON.stringify(records),original);assert.equal(vault.profiles[0].currency,'USD');
 const reloaded=P.migrate(JSON.parse(JSON.stringify(vault)));assert.equal(reloaded.profiles[0].settings.theme,'aero');assert.equal(reloaded.profiles[1].settings.theme,'gold');
});
test('existing profile customization wins over legacy global state and migration is repeatable',()=>{
 const vault={globalSettings:{theme:'gold'},profiles:[{role:'accounting',settings:{theme:'titanium',businessName:'Propio'},workspace:{page:'transactions',inputs:{'filter-search':'recibo'}}}]};
 P.migrate(vault);const once=JSON.stringify(vault);P.migrate(vault);assert.equal(JSON.stringify(vault),once);assert.equal(vault.profiles[0].workspace.page,'transactions');assert.equal(vault.profiles[0].workspace.inputs['filter-search'],'recibo');
});
test('specialty changes preserve hidden records and repair only unavailable destination',()=>{
 const p={role:'insurance',realEstateProperties:[{id:'r',price:700000}],settings:{theme:'aero'},workspace:{page:'realestate'}};
 P.settings(p);assert.equal(p.workspace.page,'insurance');assert.equal(p.realEstateProperties[0].price,700000);assert.deepEqual(P.role(p).quotes,['insurance','retirement']);
 p.role='realestate';P.settings(p);assert.equal(p.workspace.page,'realestate');assert(!P.role(p).pages.includes('insurance'));assert(!P.role(p).quotes.includes('insurance'));
});
