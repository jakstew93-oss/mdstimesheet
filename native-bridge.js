// Links the web app to the MDS Timesheet Android app: watch and widget times, downloads, sharing and copying.
// Does nothing in an ordinary browser, where window.MDSNative doesn't exist.
(function(root){
 'use strict';
 const TIME_FIELDS=['startTime','timeOnSite','timeOffSite','endTime'];
 const STAGES=['Start','On site','Off site','Finish'];

 // The set to bring into Quick Start: the draft's own set if the watch has sent more of it, otherwise the newest
 // set that hasn't already been saved as an entry.
 function pickRun(runs,savedIds,draftId){
  const last=r=>r.times[r.times.length-1].epochMillis;
  const open=(runs||[]).filter(r=>r&&r.id&&Array.isArray(r.times)&&r.times.length&&!savedIds.has(r.id));
  return open.find(r=>r.id===draftId)||open.sort((a,b)=>last(a)-last(b)).pop()||null;
 }
 // Fills the Quick Start draft from a recorded set. Each tap is brought in once: [seen] lists the taps already
 // brought in, so a time corrected or cleared by hand (or by Reset) stays that way when the next tap arrives.
 // On a set the watch took over from the phone, the first [baseCount] times came from the phone and are skipped.
 // Times already in the draft from somewhere else are never overwritten.
 function mergeDraft(draft,recorded,seen=[],baseCount=0){
  draft=draft||{};
  const incoming=recorded.draft,id=incoming._widget.id,times=incoming._widget.times;
  const same=!!draft._widget&&draft._widget.id===id;
  if(!same&&TIME_FIELDS.some(k=>draft[k]))return null;
  const known=new Set([...seen,...(same&&Array.isArray(draft._widget.times)?draft._widget.times.map(t=>t.epochMillis):[])]);
  const fresh=times.map((t,i)=>i).filter(i=>i>=baseCount&&!known.has(times[i].epochMillis));
  if(!fresh.length)return {draft,changed:false,added:0};
  const next={...draft,date:same&&draft.date||incoming.date,_widget:incoming._widget};
  fresh.forEach(i=>{next[TIME_FIELDS[i]]=incoming[TIME_FIELDS[i]]});
  return {draft:next,changed:true,added:fresh.length,taps:fresh.map(i=>times[i].epochMillis),last:fresh[fresh.length-1]};
 }
 // The Quick Start times as tap times the watch understands, from Start up to the first empty stage. A stage
 // still showing the time the watch recorded keeps the watch's exact timestamp.
 function draftTimes(draft,today){
  const out=[],date=/^\d{4}-\d{2}-\d{2}$/.test(draft.date||'')?draft.date:today;
  const recorded=draft._widget&&Array.isArray(draft._widget.times)?draft._widget.times:[];
  for(let i=0;i<TIME_FIELDS.length;i++){
   const hm=draft[TIME_FIELDS[i]];if(!/^\d{2}:\d{2}$/.test(hm||''))break;
   const prev=out.length?out[out.length-1].epochMillis:0,r=recorded[i];
   if(r&&new Date(r.epochMillis+r.offsetSeconds*1000).toISOString().slice(11,16)===hm&&r.epochMillis>=prev){out.push({epochMillis:r.epochMillis,offsetSeconds:r.offsetSeconds});continue}
   let d=new Date(date+'T'+hm+':00');
   while(d.getTime()<prev)d=new Date(d.getTime()+86400000);  // carried on past midnight
   out.push({epochMillis:d.getTime(),offsetSeconds:-d.getTimezoneOffset()*60});
  }
  return out;
 }
 // What to tell the watch about the day in Quick Start: in progress, or cleared or saved since it was last sent.
 function dayMessage(draft,seen,lastSent,saved,today){
  draft=draft||{};
  const times=draftTimes(draft,today);
  if(times.length)return {state:'active',id:draft._widget&&draft._widget.id||null,times,seen};
  if(lastSent&&lastSent.state==='active')return {state:saved?'saved':'cleared',id:lastSent.id,times:[],seen:[]};
  return null;
 }

 const api={pickRun,mergeDraft,draftTimes,dayMessage,TIME_FIELDS};
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
 // The taps from each recorded set already brought into Quick Start, so Reset and hand edits stick.
 const HANDLED_KEY='mds_watch_handled_v1';
 function handled(){try{return JSON.parse(localStorage.getItem(HANDLED_KEY)||'{}')||{}}catch(_){return {}}}
 function seenTaps(id,run){
  const v=handled()[id];
  if(typeof v==='number')return run?run.times.slice(0,v).map(t=>t.epochMillis):[];  // saved before taps were tracked
  return Array.isArray(v)?v:[];
 }
 function markHandled(id,taps){
  const all=handled(),list=[...new Set([...seenTaps(id,null),...taps])];delete all[id];all[id]=list;
  const ids=Object.keys(all);ids.slice(0,Math.max(0,ids.length-50)).forEach(k=>delete all[k]);
  localStorage.setItem(HANDLED_KEY,JSON.stringify(all));
 }
 function pull(){
  if(!signedIn()||!root.MDSWidgetImport)return;
  let runs;try{runs=JSON.parse(native.pendingRuns()||'[]')}catch(_){return}
  const current=readDraft();
  const run=pickRun(runs,savedIds(),current._widget&&current._widget.id);if(!run)return;
  let recorded;try{recorded=root.MDSWidgetImport.normalise({version:1,id:run.id,times:run.times})}catch(_){return}
  const result=mergeDraft(current,recorded,seenTaps(run.id,run),run.baseCount|0);
  if(!result){if(!warned.has(run.id)){warned.add(run.id);toast('⌚ Watch times are waiting. Save or reset this entry to bring them in.')}return}
  if(!result.changed)return;
  localStorage.setItem('mds_qs_draft',JSON.stringify({...result.draft,_savedAt:new Date().toISOString()}));
  markHandled(run.id,result.taps);
  // Don't redraw under someone mid-typing; the next check brings the times in.
  if(!(document.activeElement&&document.activeElement.closest?.('.quickstart')&&/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))&&typeof renderAll==='function')renderAll();
  toast('⌚ '+STAGES[result.last]+' '+result.draft[TIME_FIELDS[result.last]]+' added from your '+(run.source==='watch'?'watch':'widget'));
 }

 // ---------- The day in progress, sent to the watch ----------
 // Times logged on the phone show on the watch, and its next tap carries on from there.
 const SENT_KEY='mds_watch_sent_v1';
 let savedId=null;
 document.addEventListener('mds-entry-saved',()=>{try{savedId=(JSON.parse(localStorage.getItem(SENT_KEY)||'null')||{}).id||null}catch(_){}});
 function newId(){return root.crypto&&crypto.randomUUID?crypto.randomUUID():'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
 function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
 function sendDay(){
  if(!native.syncDay||!signedIn())return;
  let lastSent;try{lastSent=JSON.parse(localStorage.getItem(SENT_KEY)||'null')}catch(_){lastSent=null}
  const draft=readDraft(),id=draft._widget&&draft._widget.id;
  const message=dayMessage(draft,id?seenTaps(id,null):[],lastSent,!!lastSent&&(lastSent.id===savedId||savedIds().has(lastSent.id)),today());
  if(!message)return;
  if(!message.id){
   // A day started on the phone gets its own id, so the watch's taps come back into this entry.
   message.id=newId();
   localStorage.setItem('mds_qs_draft',JSON.stringify({...draft,_widget:{id:message.id,times:message.times}}));
  }
  const sig=JSON.stringify(message);
  if(lastSent&&lastSent.sig===sig)return;
  try{native.syncDay(JSON.stringify({...message,rev:Date.now()}))}catch(_){return}
  localStorage.setItem(SENT_KEY,JSON.stringify({id:message.id,state:message.state,sig}));
 }
 function check(){pull();sendDay()}
 setInterval(()=>{if(!document.hidden)check()},4000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
 addEventListener('load',check);
 // Send a time stamped or typed on the phone straight away rather than at the next check.
 ['click','change'].forEach(type=>document.addEventListener(type,()=>setTimeout(sendDay,400),true));

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
 root.MDSBridge={pull:check};
})(typeof window==='undefined'?globalThis:window);
