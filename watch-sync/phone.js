(function(){
'use strict';
let applying=false,busy=false,status='Watch sync is not connected';
const user=()=>localStorage.getItem('ts_auth_user');
const key=()=> 'mds_watch_sync_v1_'+user();
const load=()=>JSON.parse(localStorage.getItem(key())||'null');
const save=s=>localStorage.setItem(key(),JSON.stringify(s));
const uuid=()=>crypto.randomUUID();
function endpoint(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Enter the HTTPS service address without a path');return u.origin;}
function capture(){
 const s=load();if(!s||applying||!user()||localStorage.getItem('timesheet_employee')!==user())return;
 const data=readWeekStore(),current={};let changed=false;
 for(const bucket of Object.values(data.weeks))for(const entry of bucket.entries){
  if(!entry._syncId||s.rows[entry._syncId]?.deleted){entry._syncId=uuid();changed=true;}
  current[entry._syncId]=entry;
  const changes=MDSWatchCore.diff(s.observed[entry._syncId],entry);
  if(Object.keys(changes).length)s.queue.push({id:uuid(),entryId:entry._syncId,kind:'patch',changes});
 }
 for(const id of Object.keys(s.observed))if(!current[id])s.queue.push({id:uuid(),entryId:id,kind:'delete'});
 s.observed=current;save(s);
 if(changed){applying=true;try{writeWeekStore(data);}finally{applying=false;}}
}
function install(s){
 const data=readWeekStore();
 for(const bucket of Object.values(data.weeks))bucket.entries=bucket.entries.filter(e=>!e._syncId||!(e._syncId in s.rows));
 for(const [id,row] of Object.entries(s.rows)){
  if(row.deleted||!MDSTools.validDate(row.date))continue;
  const week=MDSTools.weekFor(row.date),entry={...row,_syncId:id};
  entry.totalHours=entry.startTime&&entry.endTime?calcHours(entry.startTime,entry.endTime):'';
  entry.breakMins=entry.totalHours?getBreakMins(entry.totalHours):0;
  const bucket=data.weeks[week]||(data.weeks[week]={entries:[],archived:week<currentWeekEnding()});bucket.entries.push(entry);
 }
 for(const bucket of Object.values(data.weeks))bucket.entries.sort((a,b)=>a.date.localeCompare(b.date)||(a.startTime||'').localeCompare(b.startTime||''));
 applying=true;try{writeWeekStore(data);renderAll();}finally{applying=false;}
 s.observed=Object.fromEntries(Object.values(data.weeks).flatMap(w=>w.entries).filter(e=>e._syncId).map(e=>[e._syncId,e]));save(s);
}
async function request(s,path,body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch(s.endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Service unavailable');return data;}finally{clearTimeout(timeout);}
}
async function sync(){
 if(busy||!user()||document.getElementById('loginScreen')?.classList.contains('hidden')===false)return;
 const account=user();if(localStorage.getItem('timesheet_employee')!==account)return;
 let s=load();if(!s)return;busy=true;
 try{
  capture();let more=true,round=0;
  while(more&&round++<25){
   s=load();const token=s.token,configuration=s.endpoint;
   const data=await request(s,'/v1/sync',{operations:s.queue.slice(0,50),cursor:s.cursor});
   if(user()!==account)return;
   const latest=load();if(!latest||latest.token!==token||latest.endpoint!==configuration)return;
   capture();s=load();
   for(const op of data.operations)MDSWatchCore.apply(s.rows,MDSWatchCore.validate(op));
   const ack=new Set(data.ack);s.queue=s.queue.filter(op=>!ack.has(op.id));
   // Overlay durable, unsent local edits so a pull cannot erase an offline tap/edit.
   for(const op of s.queue)MDSWatchCore.apply(s.rows,op);
   s.cursor=data.cursor;save(s);install(s);more=data.more||s.queue.length>0;
  }
  status=s.queue.length?'More entries waiting to sync':'Watch and phone synced';
 }catch(_){status='Saved on this phone · waiting to sync';}finally{busy=false;updateStatus();}
}
let dialog;
function updateStatus(){const el=document.getElementById('watch-sync-status');if(el)el.textContent=status;}
function open(){
 if(!user())return;
 if(!dialog){dialog=document.createElement('dialog');dialog.style.cssText='max-width:420px;width:90%;padding:22px;border-radius:18px;background:#14201b;color:#fff;border:1px solid #3b6550';document.body.append(dialog);}
 dialog.replaceChildren();
 const heading=document.createElement('h2');heading.textContent='Connect your watch';dialog.append(heading);
 const desc=document.createElement('p');desc.textContent='Connect this employee’s timesheets to your watch using your sync service. Other forms stay on this device.';dialog.append(desc);
 const label=document.createElement('label');label.textContent='Sync service HTTPS address';
 const input=document.createElement('input');input.type='url';input.placeholder='https://your-sync-service.workers.dev';input.value=load()?.endpoint||'';input.style.cssText='width:100%;margin:10px 0;padding:12px';label.append(input);dialog.append(label);
 const message=document.createElement('p');message.id='watch-sync-status';message.setAttribute('role','status');dialog.append(message);updateStatus();
 const code=document.createElement('p');code.style.cssText='font-size:28px;letter-spacing:3px';dialog.append(code);
 const connect=document.createElement('button');connect.textContent='Get watch pairing code';connect.type='button';
 connect.onclick=async()=>{
  connect.disabled=true;const account=user();
  try{
   const address=endpoint(input.value.trim());let s=load();
   if(s&&s.endpoint!==address)throw Error('Disconnect before changing services');
   if(!s){const bytes=crypto.getRandomValues(new Uint8Array(32));s={endpoint:address,token:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),rows:{},observed:{},queue:[],cursor:0};save(s);}
   capture();await sync();const result=await request(s,'/v1/pair',{});
   if(user()!==account)return;
   code.textContent=result.code;message.textContent='On the watch, enter this service address and code. Code expires in five minutes; use it once. Keep it private.';
  }catch(error){message.textContent=error.message||'Could not connect';}finally{connect.disabled=false;}
 };
 const now=document.createElement('button');now.textContent='Sync now';now.onclick=sync;
 const disconnect=document.createElement('button');disconnect.textContent='Disconnect this phone';disconnect.onclick=()=>{if(confirm('Stop syncing this phone? Saved timesheets remain here. The watch retains its connection.')){localStorage.removeItem(key());status='Watch sync is not connected';code.textContent='';updateStatus();}};
 const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();
 for(const b of [connect,now,disconnect,close]){b.style.cssText='display:block;min-height:44px;margin:10px 0;width:100%';dialog.append(b);}
 dialog.showModal();
}
const originalWrite=writeWeekStore;
writeWeekStore=function(data){originalWrite(data);if(!applying){capture();queueMicrotask(sync);}};
const button=document.createElement('button');button.type='button';button.textContent='Connect watch';button.style.cssText='min-height:44px;margin:10px';button.onclick=open;
(document.getElementById('ts-tabs')||document.body).append(button);
let previousUser=user();
setInterval(()=>{if(user()!==previousUser){previousUser=user();dialog?.close();status='Watch sync is not connected';}if(!document.hidden)sync();},15000);
window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
window.MDSWatchSync={capture,sync};
sync();
})();
