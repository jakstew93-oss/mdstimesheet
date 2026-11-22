// Shared company configuration: fleet vans, default feature rollouts, company rate defaults,
// and driver-wide notice banner. Edited from the Admin page (Jak Stewart) and published to GitHub.
(function(root){
 'use strict';
 const OVERRIDE_KEY='mds_site_config_override_v1';
 const DISMISSED_KEY='mds_notice_dismissed_v1';
 const SEEN_CHANGELOG_KEY='mds_changelog_seen_v1';
 const BASE_CONFIG={
  fleet:[
   ["LA68 GEU","Martyn’s Van"],
   ["LD68 ULM","Jak’s Van"],
   ["SK69 PWV","Matt’s Van"],
   ["AY22 HTF","Ash’s Van"],
   ["BX22 VXR","Big Van"],
  ],
  features:{
   payEstimate:["Martyn Evans","Oliver Spicer","Ash Kemp","Matthew Heath","Tobi Culver","Cody Slack","Michael Simpson","Cameron Simpson"],
   shiftDial:["Jak Stewart"],
   sundayReminder:["Jak Stewart"],
   whatIfBreak:["Jak Stewart"],
   splitDay:["Jak Stewart"],
  },
  rates:{
   mileage:0.25,
   night:20,
   holidayHours:8,
   satX:1.5,
   sunX:1.5,
  },
  notice:{
   id:"",
   text:"",
   expires:"",
  },
  changelog:{
   id:'',
   title:'',
   items:[],
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
  const cl=src.changelog&&typeof src.changelog==='object'?src.changelog:{};
  const items=Array.isArray(cl.items)?cl.items.map(x=>String(x||'').trim()).filter(Boolean).slice(0,8):[];
  return {
   fleet,
   features:{
    payEstimate:strArr(f.payEstimate,BASE_CONFIG.features.payEstimate),
    shiftDial:strArr(f.shiftDial,BASE_CONFIG.features.shiftDial),
    sundayReminder:strArr(f.sundayReminder,BASE_CONFIG.features.sundayReminder),
    whatIfBreak:strArr(f.whatIfBreak,BASE_CONFIG.features.whatIfBreak),
    splitDay:strArr(f.splitDay,BASE_CONFIG.features.splitDay),
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
   changelog:{
    id:String(cl.id||'').trim(),
    title:String(cl.title||'').trim(),
    items,
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

 function activeChangelog(cfg,seenId){
  const cl=cfg&&cfg.changelog;
  if(!cl||!Array.isArray(cl.items)||!cl.items.length)return null;
  const id=cl.id||(cl.title+'|'+cl.items[0]).slice(0,48);
  if(seenId&&seenId===id)return null;
  return {id,title:cl.title||'What’s new',items:cl.items};
 }

 function toBase64Url(str){
  const bytes=new TextEncoder().encode(str);
  let bin='';
  for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 }

 function fromBase64Url(b64){
  const norm=String(b64||'').replace(/-/g,'+').replace(/_/g,'/');
  const pad=norm.length%4?norm+'='.repeat(4-(norm.length%4)):norm;
  const bin=atob(pad);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
 }

 function encodeLoginHash(name,password){
  const n=String(name||'').trim(),p=String(password||'').trim();
  if(!n||!p)return '';
  return '#login='+toBase64Url(JSON.stringify({n,p}));
 }

 function parseLoginHash(hash){
  const m=/^#login=([A-Za-z0-9_-]+)$/.exec(String(hash||'').trim());
  if(!m)return null;
  try{
   const obj=JSON.parse(fromBase64Url(m[1]));
   const name=String(obj&&obj.n||'').trim(),password=String(obj&&obj.p||'').trim();
   return name&&password?{name,password}:null;
  }catch(_){return null}
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
  state.changelog=cleaned.changelog;
  if(root.MDSVehicleRegs&&typeof root.MDSVehicleRegs.refreshAll==='function')root.MDSVehicleRegs.refreshAll();
  if(root.document){renderNotice();addWhatsNewPref();}
  return state;
 }

 const api={
  get fleet(){return state.fleet},
  get features(){return state.features},
  get rates(){return state.rates},
  get notice(){return state.notice},
  get changelog(){return state.changelog},
  BASE_CONFIG,
  OVERRIDE_KEY,
  DISMISSED_KEY,
  SEEN_CHANGELOG_KEY,
  cleanConfig,
  activeNotice,
  activeChangelog,
  encodeLoginHash,
  parseLoginHash,
  applyConfig,
 };
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDS_CONFIG=api;
 if(!root.document)return;

 const pad=n=>String(n).padStart(2,'0');
 const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
 const read=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
 const write=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}};

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

 function showChangelog(force){
  const seen=force?'':read(SEEN_CHANGELOG_KEY);
  const shown=activeChangelog(state,seen);
  if(!shown)return false;
  if(!force&&!read('ts_auth_user'))return false;
  let dlg=document.getElementById('mds-whats-new-dialog');
  if(!dlg){
   dlg=document.createElement('dialog');
   dlg.id='mds-whats-new-dialog';
   dlg.className='mds-whats-new';
   dlg.setAttribute('aria-labelledby','mds-wn-title');
   dlg.innerHTML='<div class="wn-head"><span class="wn-badge" aria-hidden="true">✨</span><h2 id="mds-wn-title"></h2></div><ul class="wn-list"></ul><div class="wn-actions"><button type="button" class="btn btn-primary wn-ok">Got it</button></div>';
   const markSeen=()=>{
    const cur=activeChangelog(state,'');
    if(cur)write(SEEN_CHANGELOG_KEY,cur.id);
   };
   dlg.querySelector('.wn-ok').addEventListener('click',()=>{markSeen();dlg.close()});
   dlg.addEventListener('cancel',markSeen);
   document.body.append(dlg);
  }
  dlg.querySelector('#mds-wn-title').textContent=shown.title;
  const ul=dlg.querySelector('.wn-list');
  ul.replaceChildren();
  shown.items.forEach(item=>{
   const li=document.createElement('li');
   li.textContent=item;
   ul.append(li);
  });
  if(!dlg.open)dlg.showModal();
  return true;
 }
 api.showChangelog=showChangelog;

 function addWhatsNewPref(){
  const dialog=document.getElementById('app-theme-dialog');
  if(!dialog)return;
  let row=dialog.querySelector('.wn-pref');
  const hasItems=!!activeChangelog(state,'');
  if(!hasItems){if(row)row.hidden=true;return}
  if(!row){
   row=document.createElement('div');row.className='sd-pref wn-pref';
   row.innerHTML='<span>What’s new<small>See the latest app updates</small></span><button type="button" class="btn btn-outline wn-open-btn">View</button>';
   row.querySelector('.wn-open-btn').addEventListener('click',()=>{
    if(dialog.open)dialog.close();
    showChangelog(true);
   });
   dialog.append(row);
  }
  row.hidden=false;
 }

 function handleLoginHash(){
  const creds=parseLoginHash(root.location&&root.location.hash);
  if(!creds)return false;
  try{
   if(root.history&&root.history.replaceState){
    root.history.replaceState(null,'',root.location.pathname+root.location.search);
   }
  }catch(_){}
  const passwords=root.MDS_DRIVERS&&root.MDS_DRIVERS.passwords;
  if(!passwords||passwords[creds.name]!==creds.password){
   if(typeof showToast==='function')showToast('That QR login link is no longer valid.');
   return false;
  }
  const current=read('ts_auth_user')||'';
  if(current===creds.name){
   if(typeof showToast==='function')showToast('Already signed in as '+creds.name);
   return true;
  }
  if(current&&!confirm('Switch account from '+current+' to '+creds.name+'?'))return false;
  const nameEl=document.getElementById('loginName');
  const passEl=document.getElementById('loginPassword');
  if(!nameEl||!passEl||typeof root.doLogin!=='function')return false;
  nameEl.value=creds.name;
  passEl.value=creds.password;
  root.doLogin();
  if(typeof showToast==='function')showToast('Signed in as '+creds.name);
  return true;
 }

 function bootUI(){
  renderNotice();
  addWhatsNewPref();
  handleLoginHash();
  showChangelog(false);
  const origLogin=root.doLogin;
  if(typeof origLogin==='function'&&!origLogin._mdsWnWrapped){
   const wrapped=function(){
    const res=origLogin.apply(this,arguments);
    setTimeout(()=>{renderNotice();showChangelog(false)},150);
    return res;
   };
   wrapped._mdsWnWrapped=true;
   root.doLogin=wrapped;
  }
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootUI,{once:true});
 else bootUI();
 root.addEventListener('load',bootUI);
 root.addEventListener('hashchange',handleLoginHash);
 document.addEventListener('click',e=>{
  if(e.target&&e.target.closest&&e.target.closest('#app-theme-button'))setTimeout(addWhatsNewPref,0);
 },true);
})(typeof window==='undefined'?globalThis:window);
