(function (root) {
  'use strict';
  const finance = typeof module !== 'undefined' ? require('./finance-core.cjs') : root.Finance;
  const titles = {services:'Cotización de servicios',insurance:'Cotización de seguro',mortgage:'Simulación hipotecaria',retirement:'Proyección de retiro'};
  const fail = message => { throw new Error(message); };
  function text(value, label, max = 160, required = false) {
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string') fail('Revisa '+label+'.');
    const result=value.trim();
    if (result.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) fail(label+': texto demasiado largo o inválido.');
    if(required && !result) fail('Completa '+label+'.');
    return result;
  }
  function decimal(value,label,max=1e9,min=0) {
    if (!['string','number'].includes(typeof value) || String(value).trim()==='') fail('Completa '+label+'.');
    const s=String(value).trim();
    if(!/^\d+(\.\d{1,2})?$/.test(s)) fail(label+': usa un número positivo con hasta dos decimales.');
    const n=Number(s);if(!Number.isFinite(n)||n<min||n>max) fail(label+': importe fuera de rango.');
    return n;
  }
  function integer(value,label,min,max) {const n=decimal(value,label,max,min);if(!Number.isInteger(n)) fail(label+': usa un número entero.');return n;}
  function contact(value,label,required=false) {
    if(!value || typeof value!=='object' || Array.isArray(value)) fail('Revisa los datos de '+label+'.');
    const c={name:text(value.name,'nombre de '+label,160,required),email:text(value.email,'correo de '+label,160),phone:text(value.phone,'teléfono de '+label,60)};
    if(c.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.email)) fail('Revisa el correo de '+label+'.');
    return c;
  }
  function validate(input) {
    if(!input || input.version!==1 || !Object.hasOwn(titles,input.type)) fail('Tipo de cotización no válido.');
    if(!['MXN','USD','EUR'].includes(input.currency)) fail('Moneda no válida.');
    if(!finance.validDate(input.date)||!finance.validDate(input.validUntil)||input.validUntil<input.date) fail('La vigencia debe ser una fecha válida igual o posterior a la emisión.');
    const issuer=contact(input.issuer,'emisor');issuer.business=text(input.issuer.business,'nombre comercial',160,true);
    const q={version:1,type:input.type,currency:input.currency,number:text(input.number,'folio',60,true),date:input.date,validUntil:input.validUntil,issuer,customer:contact(input.customer,'cliente',true),notes:text(input.notes,'observaciones',3000)};
    const d=input.details;if(!d||typeof d!=='object'||Array.isArray(d)) fail('Faltan los conceptos de la cotización.');
    if(q.type==='services') {
      if(!Array.isArray(d.items)||d.items.length<1||d.items.length>40) fail('Incluye de 1 a 40 conceptos.');
      q.details={items:d.items.map(item=>({description:text(item?.description,'descripción del concepto',240,true),quantity:decimal(item?.quantity,'cantidad',10000,.01),unitPrice:decimal(item?.unitPrice,'precio unitario')})),discountPct:decimal(d.discountPct,'descuento',100),taxPct:decimal(d.taxPct,'impuesto',100)};
    } else if(q.type==='insurance') {
      q.details={plan:text(d.plan,'plan',160,true),company:text(d.company,'aseguradora',160),coverage:decimal(d.coverage,'suma asegurada'),annualPremium:decimal(d.annualPremium,'prima anual',1e9,.01)};
    } else if(q.type==='mortgage') {
      q.details={property:text(d.property,'inmueble',240,true),price:decimal(d.price,'precio del inmueble',1e9,.01),downPct:decimal(d.downPct,'porcentaje de enganche',100),years:integer(d.years,'plazo en años',1,50),annualRate:decimal(d.annualRate,'tasa anual',100),extra:decimal(d.extra,'aportación adicional')};
    } else {
      q.details={plan:text(d.plan,'plan de retiro',160,true),monthly:decimal(d.monthly,'aportación mensual',1e9,.01),currentAge:integer(d.currentAge,'edad actual',0,99),retireAge:integer(d.retireAge,'edad de retiro',1,100),annualRate:decimal(d.annualRate,'rendimiento anual',30),inflation:decimal(d.inflation,'inflación anual',30)};
      if(q.details.retireAge<=q.details.currentAge) fail('La edad de retiro debe superar la edad actual.');
    }
    return q;
  }
  const cents=n=>BigInt(Math.round(n*100));
  function safeAmount(n) {const v=Number(n)/100;if(!Number.isSafeInteger(Number(n))||v>1e12) fail('El total supera el límite de la cotización.');return v;}
  function calculate(raw) {
    const q=validate(raw),d=q.details;
    if(q.type==='services') {
      const lines=d.items.map(i=>({...i,total:safeAmount((cents(i.quantity)*cents(i.unitPrice)+50n)/100n)}));
      const subtotal=lines.reduce((s,i)=>s+cents(i.total),0n);
      const discount=(subtotal*cents(d.discountPct)+5000n)/10000n;
      const base=subtotal-discount,tax=(base*cents(d.taxPct)+5000n)/10000n;
      return {quote:q,lines,subtotal:safeAmount(subtotal),discount:safeAmount(discount),tax:safeAmount(tax),total:safeAmount(base+tax)};
    }
    if(q.type==='insurance') return {quote:q,total:d.annualPremium,monthly:Math.round(d.annualPremium/12*100)/100};
    if(q.type==='mortgage') {
      const down=safeAmount((cents(d.price)*cents(d.downPct)+5000n)/10000n),principal=Math.round((d.price-down)*100)/100;
      const payment=finance.loanPayment(principal,d.annualRate/100,d.years*12);
      return {quote:q,down,principal,payment:Math.round(payment*100)/100,total:Math.round(payment*d.years*12*100)/100};
    }
    const years=d.retireAge-d.currentAge,months=years*12;
    const projected=finance.futureValue(d.monthly,d.annualRate/100,months);
    if(!Number.isFinite(projected)||projected>1e12) fail('La proyección supera el límite; revisa aportaciones y rendimiento.');
    return {quote:q,years,months,invested:Math.round(d.monthly*months*100)/100,total:Math.round(projected*100)/100,presentValue:Math.round(projected/Math.pow(1+d.inflation/100,years)*100)/100};
  }
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function money(value,currency) {return new Intl.NumberFormat('es-MX',{style:'currency',currency,currencyDisplay:'code'}).format(value);}
  function date(value) {return new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));}
  const pair=(label,value)=>`<div class="qp-pair"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  function body(raw) {
    const r=calculate(raw),q=r.quote,d=q.details,m=n=>money(n,q.currency);let contents='',disclaimer='';
    if(q.type==='services') {
      contents=`<table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead><tbody>${r.lines.map(i=>`<tr><td>${esc(i.description)}</td><td>${i.quantity}</td><td>${esc(m(i.unitPrice))}</td><td>${esc(m(i.total))}</td></tr>`).join('')}</tbody></table><div class="qp-totals">${pair('Subtotal',m(r.subtotal))}${pair('Descuento ('+d.discountPct+'%)',m(r.discount))}${pair('Impuesto indicado ('+d.taxPct+'%)',m(r.tax))}<div class="qp-grand">${pair('Total cotizado',m(r.total))}</div></div>`;
      disclaimer='Importes y porcentaje de impuesto proporcionados por el emisor. Esta cotización no es una factura ni un comprobante de pago.';
    } else if(q.type==='insurance') {
      contents=`<h2>${esc(d.plan)}</h2>${d.company?pair('Aseguradora',d.company):''}${pair('Suma asegurada / cobertura',d.coverage?m(d.coverage):'Por definir')}${pair('Prima anual indicada',m(d.annualPremium))}${pair('Equivalente mensual (prima anual / 12)',m(r.monthly))}`;
      disclaimer='Propuesta informativa con datos proporcionados por el asesor. No constituye póliza, aceptación de riesgo ni confirmación de cobertura. El equivalente mensual no incluye recargos por pago fraccionado. La prima, exclusiones y condiciones finales deben confirmarse con la aseguradora.';
    } else if(q.type==='mortgage') {
      contents=`<h2>${esc(d.property)}</h2>${pair('Precio del inmueble',m(d.price))}${pair('Enganche ('+d.downPct+'%)',m(r.down))}${pair('Capital a financiar',m(r.principal))}${pair('Plazo',d.years+' años / '+d.years*12+' mensualidades')}${pair('Tasa nominal anual fija',d.annualRate+'%')}${pair('Mensualidad base estimada',m(r.payment))}${pair('Aportación extra indicada al mes',m(d.extra))}${pair('Salida mensual inicial con aportación extra',m(Math.round((r.payment+d.extra)*100)/100))}${pair('Pagos base totales sin aportaciones extra',m(r.total))}`;
      disclaimer='Simulación de amortización francesa a tasa fija, con tasa mensual igual a tasa anual / 12. La última mensualidad puede ajustarse por redondeo. No incluye seguros, comisiones, impuestos, gastos notariales ni CAT. Las aportaciones extra no se descuentan del total base mostrado. No es una oferta de crédito ni garantiza aprobación.';
    } else {
      contents=`<h2>${esc(d.plan)}</h2>${pair('Edad actual / edad de retiro',d.currentAge+' / '+d.retireAge+' años')}${pair('Horizonte',r.years+' años / '+r.months+' meses')}${pair('Aportación al cierre de cada mes',m(d.monthly))}${pair('Rendimiento nominal anual supuesto',d.annualRate+'%')}${pair('Inflación anual supuesta',d.inflation+'%')}${pair('Capital aportado',m(r.invested))}${pair('Fondo nominal proyectado',m(r.total))}${pair('Fondo en poder adquisitivo actual',m(r.presentValue))}`;
      disclaimer='Proyección ilustrativa con aportaciones constantes al cierre de cada mes y capitalización mensual (tasa anual / 12). No incorpora comisiones, impuestos, seguros ni retiros. Los rendimientos y el valor final no están garantizados; la inflación es un supuesto editable.';
    }
    return `<article class="quote-paper"><header><div><div class="qp-brand">${esc(q.issuer.business)}</div>${q.issuer.name?`<p>${esc(q.issuer.name)}</p>`:''}<p>${[q.issuer.phone,q.issuer.email].filter(Boolean).map(esc).join(' · ')}</p></div><div class="qp-meta"><span>COTIZACIÓN</span><strong>${esc(q.number)}</strong><span>Moneda: ${q.currency}</span></div></header><h1>${titles[q.type]}</h1><div class="qp-dates">${pair('Fecha de emisión',date(q.date))}${pair(q.type==='mortgage'||q.type==='retirement'?'Revisar supuestos hasta':'Vigencia de propuesta hasta',date(q.validUntil))}</div><section class="qp-client"><span>PREPARADA PARA</span><h2>${esc(q.customer.name)}</h2><p>${[q.customer.phone,q.customer.email].filter(Boolean).map(esc).join(' · ')}</p></section><section class="qp-details">${contents}</section>${q.notes?`<section class="qp-notes"><h2>Observaciones y condiciones</h2><p>${esc(q.notes)}</p></section>`:''}<section class="qp-conditions"><h2>Alcance de la propuesta</h2><p>${disclaimer}</p></section></article>`;
  }
  const styles=`.quote-paper{font:13px/1.5 'Segoe UI',Arial,sans-serif;color:#17251f;background:white;overflow-wrap:anywhere}.quote-paper *{box-sizing:border-box}.quote-paper header{display:flex;justify-content:space-between;gap:24px;margin-bottom:30px}.quote-paper .qp-brand{font-size:20px;font-weight:600;letter-spacing:-.4px}.quote-paper header p{font-size:11px;color:#4f6057;margin:3px 0}.quote-paper .qp-meta{display:grid;align-content:start;gap:3px;max-width:42%;text-align:right;font-size:11px}.quote-paper h1{font-size:29px;line-height:1.2;letter-spacing:-.6px;font-weight:500;margin:0 0 20px;color:#245c45}.quote-paper h2{font-size:16px;font-weight:600;margin:0 0 12px}.quote-paper .qp-dates{display:grid;grid-template-columns:1fr 1fr;gap:20px}.quote-paper .qp-dates .qp-pair{display:grid;gap:3px;font-size:11px}.quote-paper .qp-client{margin:25px 0}.quote-paper .qp-client>span{font-size:10px;letter-spacing:1px;color:#4f6057}.quote-paper .qp-client h2{margin:5px 0}.quote-paper p{margin:0}.quote-paper .qp-client p{font-size:11px}.quote-paper table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:0}.quote-paper th,.quote-paper td{padding:10px 5px;vertical-align:top;text-align:right;font-size:11px}.quote-paper th{font-weight:500;color:#4f6057}.quote-paper th:first-child,.quote-paper td:first-child{width:43%;text-align:left;padding-left:0}.quote-paper th:nth-child(2){width:11%}.quote-paper tr{break-inside:avoid}.quote-paper thead{display:table-header-group}.quote-paper .qp-pair{display:flex;justify-content:space-between;gap:20px;margin:9px 0}.quote-paper .qp-pair span{color:#4f6057}.quote-paper .qp-pair strong{text-align:right;font-weight:500;max-width:58%}.quote-paper .qp-dates strong{text-align:left;max-width:none}.quote-paper .qp-totals{margin:20px 0 0 auto;width:65%;break-inside:avoid}.quote-paper .qp-grand{font-size:19px;margin-top:14px}.quote-paper .qp-notes,.quote-paper .qp-conditions{margin-top:26px}.quote-paper .qp-notes p{white-space:pre-wrap}.quote-paper .qp-conditions p{font-size:10px;color:#4f6057}.quote-paper .qp-conditions h2{font-size:12px;margin-bottom:6px}.quote-paper h2{break-after:avoid}.quote-paper .qp-pair,.quote-paper header,.quote-paper .qp-client{break-inside:avoid}@media print{body{margin:0;background:white}p{orphans:3;widows:3}}`;
  function document(raw) {return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Cotización MONEYMAXING</title><style>${styles}</style></head><body>${body(raw)}</body></html>`;}
  const api={validate,calculate,body,document,styles,titles};
  if(typeof module!=='undefined')module.exports=api;else root.Quotation=api;
})(globalThis);
