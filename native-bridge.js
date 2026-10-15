// Links the web app to the MDS Timesheet Android app: watch and widget times, downloads, sharing and copying.
// Does nothing in an ordinary browser, where window.MDSNative doesn't exist.
(function(root){
 'use strict';
 const TIME_FIELDS=['startTime','timeOnSite','timeOffSite','endTime'];
 const STAGES=['Start','On site','Off site','Finish'];

 // Newest recorded set that hasn't already been saved as an entry.
 function pickRun(runs,savedIds){
  const last=r=>r.times[r.times.length-1].epochMillis;
  return (runs||[]).filter(r=>r&&r.id&&Array.isArray(r.times)&&r.times.length&&!savedIds.has(r.id))
   .sort((a,b)=>last(a)-last(b)).pop()||null;
 }
 // Fills the Quick Start draft from a recorded set. Times already in the draft from somewhere else are never
 // overwritten, and a time the user corrected by hand stays corrected when the next watch tap arrives.
 // [handled] is how many of this set's stages were already brought in before; after a Reset only newer
 // stages come back.
 function mergeDraft(draft,recorded,handled=0){
  draft=draft||{};
  const incoming=recorded.draft,id=incoming._widget.id;
  const same=!!draft._widget&&draft._widget.id===id;
  if(!same&&TIME_FIELDS.some(k=>draft[k]))return null;
  const before=same?draft._widget.times.length:handled,after=incoming._widget.times.length;
  if(!same&&after<=before)return {draft,changed:false,added:0};
  if(same&&after<=before)return {draft,changed:false,added:0};
  const next={...draft,date:incoming.date,_widget:incoming._widget};
  for(let i=before;i<after;i++)next[TIME_FIELDS[i]]=incoming[TIME_FIELDS[i]];
  return {draft:next,changed:true,added:after-before};
 }

 const api={pickRun,mergeDraft,TIME_FIELDS};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSBridgeLogic=api;

 const native=root.MDSNative;
 if(!native)return;
 document.documentElement.dataset.mdsApp='android';
 const toast=m=>{if(typeof showToast==='function')showToast(m)};

 // ---------- Watch and widget times ----------
 function signedIn(){return !!localStorage.getItem('ts_auth_user')&&!!document.getElementById('loginScreen')?.classList.contains('hidden')}
 function savedIds(){
  try{return new Set(Object.values(readWeekStore().weeks).flatMap(w=>w.entries).map(e=>e.widgetCaptureId).filter(Boolean))}
  catch(_){return new Set()}
 }
 function readDraft(){try{return JSON.parse(localStorage.getItem('mds_qs_draft')||'{}')||{}}catch(_){return {}}}
 const warned=new Set();
 // How many stages of each recorded set have been brought in, so Reset clears them for good.
 const HANDLED_KEY='mds_watch_handled_v1';
 function handled(){try{return JSON.parse(localStorage.getItem(HANDLED_KEY)||'{}')||{}}catch(_){return {}}}
 function markHandled(id,count){
  const all=handled();delete all[id];all[id]=count;
  const ids=Object.keys(all);ids.slice(0,Math.max(0,ids.length-50)).forEach(k=>delete all[k]);
  localStorage.setItem(HANDLED_KEY,JSON.stringify(all));
 }
 function pull(){
  if(!signedIn()||!root.MDSWidgetImport)return;
  let runs;try{runs=JSON.parse(native.pendingRuns()||'[]')}catch(_){return}
  const run=pickRun(runs,savedIds());if(!run)return;
  let recorded;try{recorded=root.MDSWidgetImport.normalise({version:1,id:run.id,times:run.times})}catch(_){return}
  const result=mergeDraft(readDraft(),recorded,handled()[run.id]||0);
  if(!result){if(!warned.has(run.id)){warned.add(run.id);toast('⌚ Watch times are waiting. Save or reset this entry to bring them in.')}return}
  if(!result.changed)return;
  localStorage.setItem('mds_qs_draft',JSON.stringify({...result.draft,_savedAt:new Date().toISOString()}));
  markHandled(run.id,run.times.length);
  // Don't redraw under someone mid-typing; the next check brings the times in.
  if(document.activeElement&&document.activeElement.closest?.('.quickstart')&&/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
  if(typeof renderAll==='function')renderAll();
  const n=recorded.draft._widget.times.length;
  toast('⌚ '+STAGES[n-1]+' '+recorded.draft[TIME_FIELDS[n-1]]+' added from your '+(run.source==='watch'?'watch':'widget'));
 }
 setInterval(()=>{if(!document.hidden)pull()},4000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull()});
 addEventListener('load',pull);

 // ---------- Downloads ----------
 // Blob links can't be downloaded by the app directly, so hand the file over as base64.
 const realRevoke=URL.revokeObjectURL.bind(URL);
 URL.revokeObjectURL=url=>setTimeout(()=>realRevoke(url),60000);
 function toBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
 async function save(href,name){
  try{const blob=await (await fetch(href)).blob();native.saveFile(name||'download',blob.type||'application/octet-stream',await toBase64(blob))}
  catch(_){toast('Couldn’t save the file. Try again.')}
 }
 const isFileLink=a=>a&&a.hasAttribute('download')&&/^(blob|data):/.test(a.href||'');
 const realClick=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){if(isFileLink(this)){save(this.href,this.getAttribute('download'));return}return realClick.call(this)};
 document.addEventListener('click',e=>{const a=e.target.closest?.('a[download]');if(isFileLink(a)){e.preventDefault();save(a.href,a.getAttribute('download'))}},true);

 // ---------- Sharing and copying ----------
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
 Object.defineProperty(navigator,'share',{configurable:true,value:async(data={})=>{
  const file=data.files&&data.files[0];
  if(file)native.shareFile(file.name||'file',file.type||'application/octet-stream',await toBase64(file),data.title||'');
  else native.shareText(data.title||'',[data.text,data.url].filter(Boolean).join('\n'));
 }});
 const writeText=text=>{native.copyText(String(text));return Promise.resolve()};
 if(navigator.clipboard)try{Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:writeText})}catch(_){}
 else Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText,readText:()=>Promise.resolve('')}});

 // ---------- App version and updates ----------
 function addAppCard(){
  const page=document.getElementById('page-export');if(!page||document.getElementById('mds-app-card'))return;
  const card=document.createElement('div');card.className='card';card.id='mds-app-card';
  const h=document.createElement('h2');h.textContent='MDS Timesheet app';
  const p=document.createElement('p');p.className='mds-app-version';p.style.cssText='font-size:13px;color:var(--subtext);margin-bottom:14px;';p.textContent='Version '+(native.appVersion?.()||'?')+'. Updates are checked each time the app opens.';
  const b=document.createElement('button');b.type='button';b.className='btn btn-outline';b.textContent='Check for updates';b.addEventListener('click',()=>native.checkForUpdates());
  card.append(h,p,b);page.append(card);
 }
 addAppCard();addEventListener('load',addAppCard);
 root.MDSBridge={pull};
})(typeof window==='undefined'?globalThis:window);
