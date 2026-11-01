(function(root){
 'use strict';
 const common=['home','transactions','studio','security'];
 const roles={
  master:{name:'General',pages:[...common,'realestate','accounting','insurance','clients','budgets'],start:'home',quotes:['services','insurance','mortgage','retirement'],categories:null,description:'Todos los módulos y herramientas de tu perfil.'},
  personal:{name:'Finanzas personales',pages:[...common,'budgets'],start:'home',quotes:['retirement'],categories:['comida','vivienda','transporte','salud','ocio','seguros','ahorro','impuestos','otros'],description:'Controla tus gastos, presupuestos y metas personales.'},
  realestate:{name:'Asesor inmobiliario',pages:[...common,'realestate'],start:'realestate',quotes:['mortgage','services'],categories:['inmobiliario','negocio','transporte','impuestos','otros'],description:'Inmuebles, hipotecas, rentabilidad y comisiones de tu cartera.'},
  insurance:{name:'Seguros y retiro',pages:[...common,'insurance','clients'],start:'insurance',quotes:['insurance','retirement'],categories:['seguros','ahorro','negocio','transporte','impuestos','otros'],description:'Clientes, propuestas de seguros y simulaciones de retiro.'},
  accounting:{name:'Contabilidad y negocio',pages:[...common,'accounting','budgets'],start:'accounting',quotes:['services'],categories:['negocio','impuestos','vivienda','transporte','otros'],description:'Ingresos, gastos, cuentas pendientes y punto de equilibrio.'}
 };
 const themes={obsidian:'Grafito · ejecutivo',gold:'Marfil y bronce · ejecutivo',sapphire:'Azul noche · ejecutivo',titanium:'Plata y tinta · ejecutivo',amethyst:'Ciruela · ejecutivo',crimson:'Borgoña · ejecutivo','emerald-light':'Salvia · ejecutivo',aero:'Frutiger Aero · cielo y agua'};
 const defaults={theme:'obsidian',accent:'theme',paneAnim:'smooth',autoLockMinutes:5,soundEnabled:false,businessName:'',advisorName:'',advisorPhone:'',advisorEmail:''};
 function role(profile){return roles[profile?.role]||roles.master;}
 function settings(profile,legacy={}){
  if(!profile)return {...defaults};
  const source=profile.settings&&typeof profile.settings==='object'&&!Array.isArray(profile.settings)?profile.settings:legacy;
  const result={...defaults};
  for(const key of Object.keys(defaults))if(Object.hasOwn(source,key))result[key]=source[key];
  if(!Object.hasOwn(themes,result.theme))result.theme='obsidian';
  result.accent='theme';
  if(!['smooth','fast','instant'].includes(result.paneAnim))result.paneAnim='smooth';
  if(![2,5,15,30].includes(Number(result.autoLockMinutes)))result.autoLockMinutes=5;
  result.soundEnabled=result.soundEnabled===true;
  for(const k of ['businessName','advisorName','advisorPhone','advisorEmail'])result[k]=typeof result[k]==='string'?result[k].slice(0,160):'';
  profile.settings=result;
  if(!profile.workspace||typeof profile.workspace!=='object'||Array.isArray(profile.workspace))profile.workspace={};
  if(!role(profile).pages.includes(profile.workspace.page))profile.workspace.page=role(profile).start;
  return result;
 }
 function migrate(vault){for(const p of vault.profiles)settings(p,vault.globalSettings);return vault;}
 const api={roles,themes,defaults,role,settings,migrate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProfileCore=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this);
