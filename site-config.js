// Shared company configuration: fleet vans, default feature rollouts, company rate defaults,
// and driver-wide notice banner. Edited from the Admin page (Jak Stewart) and published to GitHub.
(function(root){
 'use strict';
 const OVERRIDE_KEY='mds_site_config_override_v1';
 const DISMISSED_KEY='mds_notice_dismissed_v1';
 const BASE_CONFIG={
  fleet:[
   ['LA68 GEU','Martyn’s Van'],
   ['LD68 ULM','Jak’s Van'],
   ['SK69 PWV','Matt’s Van'],
   ['AY22 HTF','Ash’s Van'],
   ['BX22 VXR','Big Van'],
  ],
  features:{
   payEstimate:['Jak Stewart','Martyn Evans','Oliver Spicer','Ash Kemp','Matthew Heath','Tobi Culver'],
   shiftDial:['Jak Stewart'],
   sundayReminder:['Jak Stewart'],
  },
  rates:{
   mileage:0.25,
   night:20,
   holidayHours:8,
   satX:1.5,
   sunX:1.5,
  },
  notice:{
   id:'',
   text:'',
   expires:'',
  },
 };

 function cleanConfig(raw){
  const src=raw&&typeof raw==='object'?raw:{};
  const fleet=Array.isArray(src.fleet)&&src.fleet.length
   ?src.fleet.map(pair=>Array.isArray(pair)?[String(pair[0]||'').trim().toUpperCase(),String(pair[1]||'').trim()]:null).filter(p=>p&&p[0])
   :BASE_CONFIG.fleet.map(p=>[...p]);
  const f=src.features&&typeof src.features==='object'?src.features:{};
  const strArr=(v,fb)=>Array.isArray(v)?[...new Set(v.map(x=>String(x||'').trim()).filter(Boolean))]:[...fb];
  const r=src.rates&&typeof src.rates==='object'?src.rates:{};
  const num=(v,fb)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:fb};
  const n=src.notice&&typeof src.notice==='object'?src.notice:{};
  return {
   fleet,
   features:{
    payEstimate:strArr(f.payEstimate,BASE_CONFIG.features.payEstimate),
    shiftDial:strArr(f.shiftDial,BASE_CONFIG.features.shiftDial),
    sundayReminder:strArr(f.sundayReminder,BASE_CONFIG.features.sundayReminder),
   },
   rates:{
    mileage:num(r.mileage,BASE_CONFIG.rates.mileage),
    night:num(r.night,BASE_CONFIG.rates.night),
    holidayHours:num(r.holidayHours,BASE_CONFIG.rates.holidayHours),
    satX:num(r.satX,BASE_CONFIG.rates.satX),
    sunX:num(r.sunX,BASE_CONFIG.rates.sunX),
   },
   notice:{
    id:String(n.id||'').trim(),
    text:String(n.text||'').trim(),
    expires:/^\d{4}-\d{2}-\d{2}$/.test(String(n.expires||''))?String(n.expires):'',
   },
  };
 }

 function activeNotice(cfg,todayISO,dismissedId){
  const n=cfg&&cfg.notice;
  if(!n||!n.text)return null;
  if(n.expires&&todayISO&&todayISO>n.expires)return null;
  const id=n.id||n.text.slice(0,40);
  if(dismissedId&&dismissedId===id)return null;
  return {id,text:n.text,expires:n.expires};
 }

 function loadInitial(){
  try{
   const saved=typeof localStorage!=='undefined'&&localStorage.getItem(OVERRIDE_KEY);
   if(saved)return cleanConfig(JSON.parse(saved));
  }catch(_){}
  return cleanConfig(BASE_CONFIG);
 }

 const state=loadInitial();

 function applyConfig(next){
  const cleaned=cleanConfig(next);
  state.fleet=cleaned.fleet;
  state.features=cleaned.features;
  state.rates=cleaned.rates;
  state.notice=cleaned.notice;
  if(root.MDSVehicleRegs&&typeof root.MDSVehicleRegs.refreshAll==='function')root.MDSVehicleRegs.refreshAll();
  if(root.document)renderNotice();
  return state;
 }

 const api={
  get fleet(){return state.fleet},
  get features(){return state.features},
  get rates(){return state.rates},
  get notice(){return state.notice},
  BASE_CONFIG,
  OVERRIDE_KEY,
  DISMISSED_KEY,
  cleanConfig,
  activeNotice,
  applyConfig,
 };
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDS_CONFIG=api;
 if(!root.document)return;

 const pad=n=>String(n).padStart(2,'0');
 const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
 const read=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
 const write=(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}};

 function renderNotice(){
  const app=document.getElementById('mds-app');
  if(!app)return;
  let bar=document.getElementById('mds-driver-notice');
  const shown=activeNotice(state,todayStr(),read(DISMISSED_KEY));
  if(!shown){if(bar)bar.hidden=true;return}
  if(!bar){
   bar=document.createElement('div');bar.id='mds-driver-notice';bar.className='mds-driver-notice';bar.setAttribute('role','status');
   bar.innerHTML='<span class="dn-icon" aria-hidden="true">📢</span><span class="dn-text"></span><button type="button" class="dn-close" aria-label="Dismiss notice">✕</button>';
   bar.querySelector('.dn-close').addEventListener('click',()=>{
    const cur=activeNotice(state,todayStr(),'');
    if(cur)write(DISMISSED_KEY,cur.id);
    bar.hidden=true;
   });
   const header=app.querySelector(':scope > header');
   if(header)header.after(bar);else app.prepend(bar);
  }
  bar.querySelector('.dn-text').textContent=shown.text;
  bar.hidden=false;
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderNotice,{once:true});
 else renderNotice();
 root.addEventListener('load',renderNotice);
})(typeof window==='undefined'?globalThis:window);
