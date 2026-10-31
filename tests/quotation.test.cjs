const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const Q=require('../quotation-core.cjs');const {createExportHandler,atomicWrite}=require('../quotation-pdf.cjs');
const quote=(type='services',details={items:[{description:'Asesoría',quantity:2,unitPrice:100.10},{description:'Ajuste',quantity:3,unitPrice:.10}],discountPct:10,taxPct:16})=>({version:1,type,currency:'MXN',number:'COT-TEST',date:'2026-10-30',validUntil:'2026-11-14',issuer:{business:'Despacho de prueba',name:'Asesor',email:'',phone:''},customer:{name:'Cliente de prueba',email:'',phone:''},notes:'',details});
test('service quotation rounds each line, discount and tax to cents against known totals',()=>{
 const r=Q.calculate(quote());assert.equal(r.subtotal,200.5);assert.equal(r.discount,20.05);assert.equal(r.tax,28.87);assert.equal(r.total,209.32);
 const q=quote();q.details.items=[{description:'Fracción',quantity:.5,unitPrice:.01}];q.details.discountPct=0;q.details.taxPct=0;assert.equal(Q.calculate(q).total,.01);
});
test('mortgage and retirement estimates match zero-rate known cases',()=>{
 const loan=Q.calculate(quote('mortgage',{property:'Prueba',price:12000,downPct:0,years:1,annualRate:0,extra:100}));assert.equal(loan.payment,1000);assert.equal(loan.total,12000);
 const retirement=Q.calculate(quote('retirement',{plan:'Retiro',monthly:100,currentAge:30,retireAge:31,annualRate:0,inflation:0}));assert.equal(retirement.total,1200);assert.equal(retirement.invested,1200);assert.equal(retirement.presentValue,1200);
});
test('insurance distinguishes annual premium from its monthly equivalent',()=>{
 const r=Q.calculate(quote('insurance',{plan:'Vida',company:'',coverage:100000,annualPremium:1000}));assert.equal(r.total,1000);assert.equal(r.monthly,83.33);assert.match(Q.body(r.quote),/recargos por pago fraccionado/);
});
test('quotes reject invalid identities, dates, amounts and unsupported types',()=>{
 for(const change of [q=>q.customer.name='',q=>q.validUntil='2026-10-01',q=>q.date='2026-02-30',q=>q.type='__proto__',q=>q.currency='XXX',q=>q.details.items[0].quantity=-1,q=>q.details.items[0].unitPrice=Infinity,q=>q.details.items[0].unitPrice=.001,q=>q.issuer.email='invalid',q=>q.details.items=new Array(41).fill(q.details.items[0])]){const q=quote();change(q);assert.throws(()=>Q.calculate(q));}
});
test('PDF markup escapes untrusted text and blocks active or remote content',()=>{
 const q=quote();q.customer.name='<img src=x onerror=alert(1)>';q.notes='<script>alert(1)</script>';const html=Q.document(q);assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes("default-src 'none'"));assert(!html.includes('http://'));
});
function fixture(overrides={}) {
 const frame={url:'http://127.0.0.1:4765/'};const wc={mainFrame:frame};const window={webContents:wc,isDestroyed:()=>false};const event={sender:wc,senderFrame:frame};let selections=0,writes=0;
 const handler=createExportHandler({getWindow:()=>window,origin:'http://127.0.0.1:4765',documentsDir:os.tmpdir(),dialog:{showSaveDialog:async()=>{selections++;return {canceled:false,filePath:path.join(os.tmpdir(),'quote.pdf')};}},render:async()=>Buffer.from('%PDF-test'),write:async()=>{writes++;},...overrides});return {handler,event,frame,wc,counts:()=>({selections,writes})};
}
test('PDF IPC rejects foreign origins, frames and web contents before opening a dialog',async()=>{
 const f=fixture();for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{url:f.frame.url}}, {...f.event,senderFrame:null}]){assert.equal((await f.handler(event,quote())).status,'error');}
 f.frame.url='http://127.0.0.1:4765.evil/';assert.equal((await f.handler(f.event,quote())).status,'error');assert.deepEqual(f.counts(),{selections:0,writes:0});
});
test('PDF cancel, invalid content and disk failure never report success',async()=>{
 const cancelled=fixture({dialog:{showSaveDialog:async()=>({canceled:true})}});assert.equal((await cancelled.handler(cancelled.event,quote())).status,'cancelled');assert.equal(cancelled.counts().writes,0);
 const bad=fixture();const invalid=quote();invalid.customer.name='';assert.equal((await bad.handler(bad.event,invalid)).status,'error');assert.equal(bad.counts().selections,0);
 const broken=fixture({write:async()=>{throw new Error('EACCES');}});assert.equal((await broken.handler(broken.event,quote())).status,'error');
});
test('only one PDF save can run at a time, then retry is available',async()=>{
 let resolve;let called;const entered=new Promise(r=>called=r);const waiting=new Promise(r=>resolve=r);
 const f=fixture({dialog:{showSaveDialog:async()=>{called();await waiting;return {canceled:true};}}});const first=f.handler(f.event,quote());await entered;assert.equal((await f.handler(f.event,quote())).status,'busy');resolve();assert.equal((await first).status,'cancelled');assert.equal((await f.handler(f.event,quote())).status,'cancelled');
});
test('PDF path is chosen by native dialog; renderer path is ignored',async()=>{
 let written;const f=fixture({write:async(file)=>{written=file;}});const q=quote();q.filePath='C:/unexpected/private.txt';assert.equal((await f.handler(f.event,q)).status,'saved');assert.equal(written,path.join(os.tmpdir(),'quote.pdf'));
});
test('atomic PDF write replaces only selected file and removes temporary files',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'moneymaxing-pdf-'));try{const file=path.join(dir,'selected.pdf');await fs.writeFile(file,'old');await fs.writeFile(path.join(dir,'preserved.txt'),'keep');await atomicWrite(file,Buffer.from('%PDF-new'));assert.equal(await fs.readFile(file,'utf8'),'%PDF-new');assert.equal(await fs.readFile(path.join(dir,'preserved.txt'),'utf8'),'keep');assert.deepEqual((await fs.readdir(dir)).sort(),['preserved.txt','selected.pdf']);}finally{await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
