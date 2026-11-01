(() => {
  'use strict';
  let context, dialog, busy=false, generation=0, currentQuote=null, currentType='services', details={};
  const $=selector=>dialog.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val=(id,fallback='')=>document.getElementById(id)?.value??fallback;
  const dateString=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const field=(name,label,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const numeric=(name,label,value,min=0,max=1e9,step='.01')=>field(name,label,value,'number',`required min="${min}" max="${max}" step="${step}"`);
  const read=name=>$(`[name="${name}"]`).value;
  function defaultDetails(client) {
    return {
      services:{items:[{description:client?.plan||'',quantity:1,unitPrice:''}],discountPct:0,taxPct:0},
      insurance:{plan:client?.plan||val('quote-policy-type'),company:'',coverage:client?.sumInsured??val('quote-sum-insured'),annualPremium:client?.premium??val('quote-premium-annual')},
      mortgage:{property:client?.plan||'Crédito hipotecario',price:val('input-re-price'),downPct:val('input-re-down'),years:val('input-re-term'),annualRate:val('input-re-rate'),extra:val('input-re-extra')},
      retirement:{plan:client?.plan||'Plan de retiro',monthly:client?.premium?Math.round(client.premium/12*100)/100:val('input-monthly-inv'),currentAge:val('input-age'),retireAge:val('input-retire-age'),annualRate:val('input-rate'),inflation:val('input-inflation')}
    };
  }
  function collectDetails() {
    if(currentType==='services') return {items:[...dialog.querySelectorAll('.quotation-line')].map(row=>({description:row.querySelector('[data-description]').value,quantity:row.querySelector('[data-quantity]').value,unitPrice:row.querySelector('[data-price]').value})),discountPct:read('discountPct'),taxPct:read('taxPct')};
    return Object.fromEntries(Object.keys(details[currentType]).map(name=>[name,read(name)]));
  }
  function renderDetails() {
    const d=details[currentType];let html='';
    if(currentType==='services')html=`<div class="quotation-lines q-full">${d.items.map((i,n)=>`<div class="quotation-line"><label>Concepto ${n+1}<input data-description value="${esc(i.description)}" maxlength="240" required></label><label>Cantidad<input data-quantity type="number" value="${esc(i.quantity)}" min=".01" max="10000" step=".01" required></label><label>Precio unitario<input data-price type="number" value="${esc(i.unitPrice)}" min="0" max="1000000000" step=".01" required></label><button class="crystal-btn" type="button" data-remove-line="${n}" aria-label="Eliminar concepto ${n+1}" ${d.items.length===1?'disabled':''}>Eliminar</button></div>`).join('')}<button class="crystal-btn" type="button" data-add-line ${d.items.length>=40?'disabled':''}>+ Añadir concepto</button></div>${numeric('discountPct','Descuento (%)',d.discountPct,0,100)}${numeric('taxPct','Impuesto indicado (%)',d.taxPct,0,100)}<p class="q-full quotation-help">El impuesto se aplica al subtotal después del descuento. Indica el porcentaje que corresponda a tu cotización.</p>`;
    if(currentType==='insurance')html=field('plan','Plan o producto',d.plan,'text','required maxlength="160"')+field('company','Aseguradora (opcional)',d.company,'text','maxlength="160"')+numeric('coverage','Suma asegurada / cobertura',d.coverage)+numeric('annualPremium','Prima anual indicada',d.annualPremium,.01);
    if(currentType==='mortgage')html=field('property','Inmueble / descripción',d.property,'text','required maxlength="240"')+numeric('price','Precio del inmueble',d.price,.01)+numeric('downPct','Enganche (%)',d.downPct,0,100)+numeric('years','Plazo (años)',d.years,1,50,1)+numeric('annualRate','Tasa nominal anual fija (%)',d.annualRate,0,100)+numeric('extra','Aportación extra mensual',d.extra);
    if(currentType==='retirement')html=field('plan','Plan / descripción',d.plan,'text','required maxlength="160"')+numeric('monthly','Aportación mensual',d.monthly,.01)+numeric('currentAge','Edad actual',d.currentAge,0,99,1)+numeric('retireAge','Edad de retiro',d.retireAge,1,100,1)+numeric('annualRate','Rendimiento anual supuesto (%)',d.annualRate,0,30)+numeric('inflation','Inflación anual supuesta (%)',d.inflation,0,30);
    $('#quotation-details').innerHTML=html;
  }
  function collect() {
    return {version:1,type:currentType,currency:read('currency'),number:read('number'),date:read('date'),validUntil:read('validUntil'),issuer:{business:read('business'),name:read('advisor'),phone:read('advisorPhone'),email:read('advisorEmail')},customer:{name:read('customer'),phone:read('customerPhone'),email:read('customerEmail')},notes:read('notes'),details:collectDetails()};
  }
  function showError(message) {$('#quotation-status').textContent='';$('#quotation-error').textContent=message;}
  function clear() {generation++;currentQuote=null;details={};if(dialog?.open)dialog.close();if(dialog)dialog.innerHTML='';}
  function open(type='services',client=null) {
    const c=context?.();if(!c||busy)return;
    if(c.types&&!c.types.includes(type))return;
    generation++;currentQuote=null;currentType=type;details=defaultDetails(client);
    const now=new Date(),until=new Date(now);until.setDate(until.getDate()+15);
    const g=c.settings;
    dialog.innerHTML=`<div class="quotation-heading"><div><h2 id="quotation-title">Preparar cotización PDF</h2><p class="quotation-help">Revisa los datos y la vista previa antes de guardar.</p></div><button type="button" class="crystal-btn" data-close-quote aria-label="Cerrar cotización">Cerrar</button></div><form id="quotation-form"><div class="quotation-grid"> <label>Tipo de documento<select name="type">${Object.entries(Quotation.titles).filter(([key])=>!c.types||c.types.includes(key)).map(([key,title])=>`<option value="${key}" ${key===type?'selected':''}>${title}</option>`).join('')}</select></label><label>Moneda<select name="currency">${['MXN','USD','EUR'].map(v=>`<option ${v===c.currency?'selected':''}>${v}</option>`).join('')}</select></label>${field('number','Folio','COT-'+dateString(now).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,6).toUpperCase(),'text','required maxlength="60"')}${field('date','Fecha de emisión',dateString(now),'date','required')}${field('validUntil','Vigencia / revisión hasta',dateString(until),'date','required')}<h3 class="q-full">Datos del cliente</h3>${field('customer','Nombre del cliente',client?.name||val('quote-client-name'),'text','required maxlength="160"')}${field('customerEmail','Correo (opcional)',client?.email||'','email','maxlength="160"')}${field('customerPhone','Teléfono (opcional)',client?.phone||'','tel','maxlength="60"')}<h3 class="q-full">Datos del emisor</h3>${field('business','Nombre comercial',g.businessName||'MONEYMAXING','text','required maxlength="160"')}${field('advisor','Nombre del asesor (opcional)',g.advisorName||'','text','maxlength="160"')}${field('advisorPhone','Teléfono del emisor (opcional)',g.advisorPhone||'','tel','maxlength="60"')}${field('advisorEmail','Correo del emisor (opcional)',g.advisorEmail||'','email','maxlength="160"')}<h3 class="q-full">Importes y condiciones</h3></div><div id="quotation-details" class="quotation-grid"></div><label class="quotation-notes">Observaciones y condiciones (opcional)<textarea name="notes" maxlength="3000" rows="4" placeholder="Alcance del servicio, forma de pago, exclusiones o información adicional"></textarea></label><div class="quotation-actions"><button class="crystal-btn" type="button" data-close-quote>Cancelar</button><button class="crystal-btn crystal-btn-primary" type="submit">Ver cotización</button></div></form><div id="quotation-preview" hidden><div class="quotation-paper-wrap"></div><div class="quotation-actions"><button class="crystal-btn" type="button" data-edit-quote>Editar datos</button><button class="crystal-btn crystal-btn-primary" type="button" id="quotation-save">Guardar PDF</button></div></div><p id="quotation-error" role="alert"></p><p id="quotation-status" role="status" aria-live="polite"></p>`;
    renderDetails();dialog.showModal();dialog.scrollTop=0;
  }
  function init(options) {
    context=options.getContext;
    const style=document.createElement('style');style.textContent=Quotation.styles;document.head.appendChild(style);
    dialog=document.createElement('dialog');dialog.id='quotation-dialog';dialog.setAttribute('aria-labelledby','quotation-title');document.body.appendChild(dialog);
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else clear();});
    dialog.addEventListener('change',e=>{
      if(e.target.name==='type'){details[currentType]=collectDetails();currentType=e.target.value;renderDetails();}
    });
    dialog.addEventListener('submit',e=>{
      e.preventDefault();if(busy)return;
      try {currentQuote=Quotation.validate(collect());$('#quotation-preview .quotation-paper-wrap').innerHTML=Quotation.body(currentQuote);$('#quotation-form').hidden=true;$('#quotation-preview').hidden=false;showError('');dialog.scrollTop=0;
        if(!window.moneymaxing?.exportQuotation){$('#quotation-save').disabled=true;showError('Abre MONEYMAXING para Windows para guardar el PDF. Esta función no está disponible en el navegador.');}
      }catch(error){showError(error.message);}
    });
    dialog.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b||busy)return;
      if(b.hasAttribute('data-close-quote'))return clear();
      if(b.hasAttribute('data-add-line')||b.hasAttribute('data-remove-line')){
        details[currentType]=collectDetails();
        if(b.hasAttribute('data-add-line')&&details.services.items.length<40)details.services.items.push({description:'',quantity:1,unitPrice:''});
        if(b.hasAttribute('data-remove-line')&&details.services.items.length>1)details.services.items.splice(Number(b.dataset.removeLine),1);
        renderDetails();return;
      }
      if(b.hasAttribute('data-edit-quote')){$('#quotation-preview').hidden=true;$('#quotation-form').hidden=false;showError('');dialog.scrollTop=0;return;}
      if(b.id!=='quotation-save'||!currentQuote)return;
      const token=generation;busy=true;dialog.querySelectorAll('button').forEach(el=>el.disabled=true);showError('');$('#quotation-status').textContent='Elige dónde guardar el PDF…';
      try {
        const result=await window.moneymaxing.exportQuotation(currentQuote);if(token!==generation)return;
        if(result.status==='saved')$('#quotation-status').textContent='PDF guardado en: '+result.filePath;
        else if(result.status==='cancelled')$('#quotation-status').textContent='Guardado cancelado. Puedes volver a intentarlo.';
        else showError(result.message||'No se pudo guardar el PDF. Inténtalo de nuevo.');
      }catch {if(token===generation)showError('No se pudo generar el PDF. Inténtalo de nuevo.');}
      finally {busy=false;if(token===generation)dialog.querySelectorAll('button').forEach(el=>el.disabled=false);}
    });
  }
  window.QuotationUI=Object.freeze({init,open,clear});
})();
