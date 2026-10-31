const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const Quotation = require('./quotation-core.cjs');

function trustedSender(event, window, origin) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return false;
  try { const u=new URL(event.senderFrame.url);return u.origin===origin && ['/', '/MONEYMAXING.html'].includes(u.pathname) && !u.search && !u.hash; }
  catch { return false; }
}

async function renderPdf(BrowserWindow, quote) {
  const window = new BrowserWindow({show:false,skipTaskbar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,javascript:false,partition:'quote-'+crypto.randomUUID()}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
  window.webContents.session.setPermissionCheckHandler(()=>false);
  window.webContents.session.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith('data:')}));
  let timer;
  try {
    const work=async()=>{
      await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(Quotation.document(quote)));
      return window.webContents.printToPDF({pageSize:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;padding:0 18mm;color:#526258;text-align:right">MONEYMAXING · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',margins:{top:.65,bottom:.65,left:.7,right:.7},generateTaggedPDF:true});
    };
    return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('PDF_TIMEOUT')),30000);})]);
  } finally {clearTimeout(timer);if(!window.isDestroyed())window.destroy();}
}

async function atomicWrite(file, bytes) {
  const temporary=path.join(path.dirname(file),'.moneymaxing-'+crypto.randomUUID()+'.tmp');
  try { const handle=await fs.open(temporary,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await fs.rename(temporary,file); }
  finally {await fs.rm(temporary,{force:true}).catch(()=>{});}
}

function createExportHandler({getWindow,origin,dialog,BrowserWindow,documentsDir,render=renderPdf,write=atomicWrite}) {
  let busy=false;
  return async (event, raw) => {
    const window=getWindow();
    if(!trustedSender(event,window,origin))return {status:'error',message:'Solicitud de PDF no autorizada.'};
    if(busy)return {status:'busy',message:'Ya hay una cotización en proceso.'};
    busy=true;
    try {
      if(JSON.stringify(raw).length>60000)throw new Error('La cotización excede el tamaño permitido.');
      let quote;
      try {quote=Quotation.validate(raw);Quotation.calculate(quote);}catch(error){return {status:'error',message:error.message};}
      const suffix=quote.number.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,60)||quote.date;
      const selected=await dialog.showSaveDialog(window,{title:'Guardar cotización en PDF',defaultPath:path.join(documentsDir,'Cotizacion-'+suffix+'.pdf'),filters:[{name:'Documento PDF',extensions:['pdf']}],properties:['showOverwriteConfirmation']});
      if(selected.canceled || !selected.filePath)return {status:'cancelled'};
      if(!/\.pdf$/i.test(selected.filePath))return {status:'error',message:'El nombre del archivo debe terminar en .pdf. Vuelve a elegir el destino.'};
      const file=selected.filePath;
      const bytes=await render(BrowserWindow,quote);
      if(!Buffer.isBuffer(bytes)||bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('INVALID_PDF');
      await write(file,bytes);
      return {status:'saved',filePath:file};
    } catch {return {status:'error',message:'No se pudo guardar el PDF. Elige una carpeta con permisos, cierra el archivo si está abierto y vuelve a intentarlo.'};}
    finally {busy=false;}
  };
}
module.exports={trustedSender,renderPdf,atomicWrite,createExportHandler};
