const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const F=require('../finance-core.cjs');
// Execute the actual legacy adapter against fixtures; do not duplicate migration logic.
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const migrationCode=source.slice(source.indexOf('function migrateLegacyData('),source.indexOf('function getActiveProfile('));
const migrate=vm.runInNewContext('('+migrationCode.trim()+')',{CATEGORIES:[['otros','Otros']]});
test('legacy fixture preserves balance, currency, transactions and budgets',()=>{
 const old={version:1,currency:'USD',initialBalance:1000,budgets:{otros:500},transactions:[{id:'legacy-1',kind:'income',amount:300,note:'Ingreso anterior',date:'2026-10-29',category:'ingreso'}]};
 const migrated=F.validate(migrate(old));const p=migrated.profiles[0];
 assert.equal(p.currency,'USD');assert.equal(p.initialBalance+F.sum(p.transactions),1300);assert.equal(p.transactions[0].id,'legacy-1');assert.equal(p.budgets.otros,500);assert.equal(old.version,1);
});
test('future vault versions are rejected without mutating the source',()=>{
 const fixture={version:99,profiles:[]};const before=JSON.stringify(fixture);assert.throws(()=>migrate(fixture));assert.equal(JSON.stringify(fixture),before);
});
