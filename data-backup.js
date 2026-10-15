// Back up or move all data on this phone: timesheets, van checks, holiday forms, expenses with receipt
// photos, test results and settings, in one file. Used to move into the MDS Timesheet app or a new phone.
(function(root){
 'use strict';
 const FORMAT='mds-timesheet-backup',VERSION=1;
 const DB_NAME='mds-expenses-v1',STORE='claims';

 function build(storageItems,claims,now=new Date()){
  return {format:FORMAT,version:VERSION,exportedAt:now.toISOString(),localStorage:storageItems,expenses:claims};
 }
 // Throws with a plain-English reason when the file isn't a usable backup.
 function check(backup){
  if(!backup||backup.format!==FORMAT)throw new Error('This isn’t an MDS Timesheet backup file.');
  if(backup.version!==VERSION)throw new Error('This backup was made by a different version of the app.');
  if(!backup.localStorage||typeof backup.localStorage!=='object'||Array.isArray(backup.localStorage))throw new Error('The backup file is damaged.');
  if(Object.values(backup.localStorage).some(v=>typeof v!=='string'))throw new Error('The backup file is damaged.');
  if(!Array.isArray(backup.expenses)||backup.expenses.some(r=>!r||typeof r.key!=='string'))throw new Error('The backup file is damaged.');
  return backup;
 }
 function summary(backup){
  const weeks=Object.keys(backup.localStorage).filter(k=>k.startsWith('timesheet_weeks_v1')).reduce((n,k)=>{try{return n+Object.keys(JSON.parse(backup.localStorage[k]).weeks||{}).length}catch(_){return n}},0);
  return {weeks,expenses:backup.expenses.length,date:new Date(backup.exportedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
 }

 const api={build,check,summary,FORMAT,VERSION};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSBackup=api;

 // ---------- Page ----------
 const toast=m=>{if(typeof showToast==='function')showToast(m)};
 function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function readClaims(){const db=await openDb();return new Promise((resolve,reject)=>{const q=db.transaction(STORE,'readonly').objectStore(STORE).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
 async function replaceClaims(claims){
  const db=await openDb();
  await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();claims.forEach(c=>s.put(c));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
 }
 async function download(){
  try{
   const items={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);items[k]=localStorage.getItem(k)}
   const backup=build(items,await readClaims());
   const blob=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='mds-backup-'+backup.exportedAt.slice(0,10)+'.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   toast('Backup saved. Keep it somewhere safe, such as Google Drive.');
  }catch(_){toast('The backup couldn’t be made. Try again.')}
 }
 function restore(){
  const input=document.createElement('input');input.type='file';input.accept='application/json,.json';
  input.addEventListener('change',async()=>{
   const file=input.files&&input.files[0];if(!file)return;
   let backup;
   try{backup=check(JSON.parse(await file.text()))}catch(e){alert(e instanceof SyntaxError?'This isn’t an MDS Timesheet backup file.':e.message);return}
   const s=summary(backup);
   if(!confirm('Replace everything on this phone with the backup from '+s.date+'?\n\n'+s.weeks+' timesheet week(s) and '+s.expenses+' expense claim(s).\n\nAnything not in the backup will be removed from this phone.'))return;
   try{
    await replaceClaims(backup.expenses);
    localStorage.clear();Object.entries(backup.localStorage).forEach(([k,v])=>localStorage.setItem(k,v));
    alert('Your data has been restored. The app will now reload.');location.reload();
   }catch(_){alert('The backup couldn’t be restored. Nothing has been lost from the file; try again.')}
  });
  input.click();
 }
 function addCard(){
  const page=document.getElementById('page-export');if(!page||document.getElementById('mds-backup-card'))return;
  const card=document.createElement('div');card.className='card';card.id='mds-backup-card';
  card.innerHTML='<h2>Back up or move your data</h2><p class="mds-backup-note" style="font-size:13px;color:var(--subtext);margin-bottom:14px;">Saves everything on this phone into one file: timesheets, van checks, holiday forms, expenses with receipt photos, test results and settings. Use it to keep a backup, or to move into the MDS Timesheet app or a new phone.</p>';
  const save=document.createElement('button');save.type='button';save.className='btn btn-primary';save.textContent='Download backup';save.style.marginBottom='10px';save.addEventListener('click',download);
  const load=document.createElement('button');load.type='button';load.className='btn btn-outline';load.textContent='Restore from a backup';load.addEventListener('click',restore);
  card.append(save,load);
  const danger=[...page.querySelectorAll('.card')].find(c=>c.textContent.includes('Danger Zone'));
  danger?danger.before(card):page.append(card);
 }
 addCard();addEventListener('load',addCard);
})(typeof window==='undefined'?globalThis:window);
