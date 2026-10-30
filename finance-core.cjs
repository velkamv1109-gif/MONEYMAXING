/* Shared validation and decimal arithmetic. Amounts on disk remain compatible with v2. */
(function (root) {
  'use strict';
  function cents(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw new Error('Monto fuera de rango.');
    return Math.round((n + Math.sign(n) * Number.EPSILON) * 100);
  }
  function amount(value, { positive = false } = {}) {
    const s = String(value).trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error('Escribe un monto con un máximo de dos decimales.');
    const result = cents(s) / 100;
    if (positive && result <= 0) throw new Error('El monto debe ser mayor que cero.');
    return result;
  }
  function sum(records, field = 'amount') { return records.reduce((s, r) => s + cents(r[field] || 0), 0) / 100; }
  function futureValue(monthly, annualRate, months) {
    if (![monthly,annualRate,months].every(Number.isFinite) || monthly < 0 || annualRate < 0 || months < 0) throw new Error('Revisa los parámetros de la proyección.');
    const rate=annualRate/12;
    return rate===0 ? monthly*months : monthly*Math.expm1(months*Math.log1p(rate))/rate;
  }
  function loanPayment(principal, annualRate, months) {
    if (![principal,annualRate,months].every(Number.isFinite) || principal<0 || annualRate<0 || months<=0) throw new Error('Revisa los parámetros del crédito.');
    const rate=annualRate/12;
    return rate===0 ? principal/months : principal*rate/(-Math.expm1(-months*Math.log1p(rate)));
  }
  function validDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  }
  function validate(data) {
    const fail = () => { throw new Error('La bóveda contiene datos inválidos o una versión no compatible. Conserva el archivo original.'); };
    if (!data || data.version !== 2 || !Array.isArray(data.profiles) || !data.profiles.length || !data.globalSettings) fail();
    const ids = new Set();
    for (const p of data.profiles) {
      if (!p || typeof p.id !== 'string' || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() ||
          !['MXN','USD','EUR'].includes(p.currency) || !['master','personal','realestate','insurance','accounting'].includes(p.role)) fail();
      ids.add(p.id);
      cents(p.initialBalance || 0);
      for (const collection of ['transactions','savingsGoals','realEstateProperties','insuranceClients','receivables','payables']) {
        if (!Array.isArray(p[collection])) fail();
        const recordIds = new Set();
        for (const r of p[collection]) {
          if (!r || typeof r.id !== 'string' || recordIds.has(r.id)) fail();
          recordIds.add(r.id);
          for (const f of ['amount','target','current','price','premium','sumInsured']) {
            if (r[f] !== undefined && (typeof r[f] !== 'number' || !Number.isFinite(r[f]) || r[f] < 0 || r[f] > 1e12)) fail();
          }
          if (collection === 'transactions' && (!['income','expense'].includes(r.kind) || !validDate(r.date) || !(r.amount > 0) || typeof r.note !== 'string' || typeof r.category !== 'string')) fail();
          if (['receivables','payables'].includes(collection) && (!validDate(r.dueDate) || typeof r.entity !== 'string' || !(r.amount > 0))) fail();
          if (collection === 'insuranceClients' && (typeof r.name !== 'string' || typeof r.plan !== 'string')) fail();
          if (collection === 'savingsGoals' && (typeof r.name !== 'string' || !(r.target > 0))) fail();
          if (collection === 'realEstateProperties' && (typeof r.title !== 'string' || !Number.isFinite(r.commissionPct) || r.commissionPct < 0 || r.commissionPct > 100)) fail();
        }
      }
      for (const v of Object.values(p.budgets || {})) if (!Number.isFinite(v) || v < 0 || v > 1e12) fail();
    }
    if (!ids.has(data.activeProfileId)) fail();
    return data;
  }
  function csvCell(value) {
    let s = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  const api = { cents, amount, sum, futureValue, loanPayment, validDate, validate, csvCell };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Finance = api;
})(globalThis);
