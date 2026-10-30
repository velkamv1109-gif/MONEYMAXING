const {test} = require('node:test');
const assert = require('node:assert/strict');
const F = require('../finance-core.cjs');
test('decimal ledger preserves known cent totals', () => {
  assert.equal(F.sum([{amount:0.1},{amount:0.2}]),0.3);
  assert.equal(F.sum(Array.from({length:1000},()=>({amount:0.01}))),10);
  assert.equal(F.amount('1000000.99'),1000000.99);
  for(const bad of ['NaN','Infinity','0.001','1e4','1000000000001']) assert.throws(()=>F.amount(bad));
  assert.throws(()=>F.amount('-1',{positive:true}));
});
test('calendar dates reject impossible dates independent of timezone', () => {
  assert.equal(F.validDate('2024-02-29'),true);
  for(const d of ['2026-02-29','2026-13-01','<img>','2026-04-31']) assert.equal(F.validDate(d),false);
});
test('loan and annuity match independent known cases including zero interest',()=>{
  assert.equal(F.loanPayment(12000,0,12),1000);
  assert(Math.abs(F.loanPayment(100000,0.12,12)-8884.878867834)<0.00001);
  assert.equal(F.futureValue(1000,0,120),120000);
  assert.equal(F.futureValue(1000,0.12,1),1000);
  assert(Math.abs(F.futureValue(1000,0.12,2)-2010)<0.00001);
  assert.equal(F.futureValue(1000,0.12,0),0);
});
test('CSV cells quote delimiters and neutralize spreadsheet formulas',()=>{
  assert.equal(F.csvCell('=1+1'),'"\'=1+1"');
  assert.equal(F.csvCell('A, "B"'),'"A, ""B"""');
  assert.equal(F.csvCell(' @SUM(A1)'),'"\' @SUM(A1)"');
});
test('unknown schema versions and invalid collection records are rejected',()=>{
  const p={id:'p',name:'Prueba',role:'personal',currency:'MXN',initialBalance:0,transactions:[],savingsGoals:[],realEstateProperties:[],insuranceClients:[],receivables:[],payables:[],budgets:{}};
  const d={version:2,activeProfileId:'p',profiles:[p],globalSettings:{}};
  assert.equal(F.validate(d),d);
  assert.throws(()=>F.validate({...d,version:99}));
  p.transactions.push({id:'x',kind:'expense',amount:2,date:'2026-02-30',note:'Prueba',category:'otros'});
  assert.throws(()=>F.validate(d));
});
