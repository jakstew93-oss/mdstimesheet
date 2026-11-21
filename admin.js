// Admin page: user/driver roster management (local + direct GitHub publish) and device tools.
// Strictly restricted to Jak Stewart — completely hidden from all other users.
(function(root){
 'use strict';
 const ADMIN_USER='Jak Stewart';
 const GH_REPO='jakstew93-oss/mdstimesheet';
 const GH_BRANCH='main';
 const GH_FILE='drivers.js';
 const TOKEN_KEY='mds_admin_gh_token';

 function isAdmin(user){return user===ADMIN_USER}

 function generatePassword(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  const initials=(parts.length>=2?parts[0][0]+parts[parts.length-1][0]:(parts[0]||'md').slice(0,2)).toLowerCase().replace(/[^a-z]/g,'x');
  const num=String(100+Math.floor(Math.random()*900));
  return initials+num;
 }

 function formatRosterLines(roster){
  return roster.map(r=>{
   const fields=["name:"+JSON.stringify(r.name)];
   if(r.password)fields.push("password:"+JSON.stringify(r.password));
   if(r.portrait)fields.push("portrait:"+JSON.stringify(r.portrait));
   return '  {'+fields.join(', ')+'},';
  }).join('\n');
 }

 function updateDriversSource(currentSource,roster){
  const re=/(const BASE_ROSTER=\[\n)([\s\S]*?)(\n \];)/;
  if(!re.test(currentSource))throw new Error('Could not locate BASE_ROSTER in drivers.js');
  return currentSource.replace(re,'$1'+formatRosterLines(roster)+'$3');
 }

 function toBase64Utf8(str){
  const bytes=new TextEncoder().encode(str);
  let bin='';
  for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
 }

 function fromBase64Utf8(b64){
  const bin=atob(String(b64||'').replace(/\s+/g,''));
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
 }

 const api={ADMIN_USER,GH_REPO,GH_BRANCH,GH_FILE,isAdmin,generatePassword,formatRosterLines,updateDriversSource};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSAdmin=api;
 if(!root.document)return;

 const $=id=>document.getElementById(id);
 const read=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
 const write=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}};
 const toast=m=>{if(typeof showToast==='function')showToast(m)};
 const currentUser=()=>read('ts_auth_user')||'';

 let panel=null,option=null,workingRoster=[],showPasswords=false,busy=false;

 function syncWorkingFromLive(){
  const d=root.MDS_DRIVERS;
  workingRoster=d?d.ROSTER.map(r=>({...r})):[];
 }

 function saveLocalOverride(roster){
  const d=root.MDS_DRIVERS;if(!d)return;
  write(d.OVERRIDE_KEY,JSON.stringify(roster));
  d.applyRoster(roster);
 }

 function clearLocalOverride(){
  const d=root.MDS_DRIVERS;if(!d)return;
  write(d.OVERRIDE_KEY,null);
  d.applyRoster(d.BASE_ROSTER);
  syncWorkingFromLive();
 }

 function hasLocalOverride(){
  const d=root.MDS_DRIVERS;
  return !!(d&&read(d.OVERRIDE_KEY));
 }

 function storageStats(){
  let bytes=0,empWeeks=[];
  try{
   for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i),v=localStorage.getItem(k)||'';
    bytes+=(k.length+v.length)*2;
    if(k.startsWith('timesheet_weeks_v1')){
     let count=0;try{count=Object.keys(JSON.parse(v).weeks||{}).length}catch(_){}
     const label=k.replace('timesheet_weeks_v1_','').replace(/_/g,' ')||'default';
     empWeeks.push(label+': '+count+' wk'+(count===1?'':'s'));
    }
   }
  }catch(_){}
  return {kb:(bytes/1024).toFixed(1),empWeeks};
 }

 async function publishToGitHub(){
  const token=(read(TOKEN_KEY)||'').trim();
  if(!token){toast('Add a GitHub token below first');return}
  if(busy)return;
  busy=true;setStatus('Publishing drivers.js to GitHub…');
  try{
   const url='https://api.github.com/repos/'+GH_REPO+'/contents/'+GH_FILE;
   const headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
   const getRes=await fetch(url+'?ref='+GH_BRANCH,{headers});
   if(!getRes.ok){
    const errText=await getRes.text().catch(()=>'');
    throw new Error('GitHub read failed ('+getRes.status+'). Check token permissions. '+errText.slice(0,100));
   }
   const fileData=await getRes.json();
   const currentSrc=fromBase64Utf8(fileData.content);
   const updatedSrc=updateDriversSource(currentSrc,workingRoster);
   const putRes=await fetch(url,{
    method:'PUT',
    headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({
     message:'Update driver roster via Admin page',
     content:toBase64Utf8(updatedSrc),
     sha:fileData.sha,
     branch:GH_BRANCH,
    }),
   });
   if(!putRes.ok){
    const errText=await putRes.text().catch(()=>'');
    throw new Error('GitHub commit failed ('+putRes.status+'). '+errText.slice(0,120));
   }
   clearLocalOverride();
   saveLocalOverride(workingRoster); // keep live until Pages finishes deploying (~30-60s)
   setStatus('Published to GitHub! Every phone will get the updated roster within ~1 minute.');
   toast('Published to GitHub');
   render();
  }catch(err){
   setStatus('Publish failed: '+(err.message||err),true);
  }finally{
   busy=false;
  }
 }

 async function copyDriversFile(){
  try{
   const res=await fetch('./drivers.js?t='+Date.now());
   const src=await res.text();
   const updated=updateDriversSource(src,workingRoster);
   await navigator.clipboard.writeText(updated);
   toast('Updated drivers.js copied to clipboard');
  }catch(_){
   toast('Could not copy drivers.js');
  }
 }

 async function copyLogins(){
  const lines=workingRoster.filter(r=>r.password).map(r=>r.name+': '+r.password).join('\n');
  try{
   await navigator.clipboard.writeText(lines);
   toast('Login list copied to clipboard');
  }catch(_){
   toast('Could not copy login list');
  }
 }

 async function forceRefreshApp(){
  if(!confirm('Clear cached app files and reload? Your saved timesheets, expenses and settings will NOT be deleted.'))return;
  try{
   if('caches' in root){
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
   }
   if(navigator.serviceWorker){
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
   }
  }catch(_){}
  location.reload();
 }

 function setStatus(msg,isErr){
  const el=$('adm-status');if(!el)return;
  el.textContent=msg||'';
  el.classList.toggle('adm-err',!!isErr);
  el.hidden=!msg;
 }

 function renderRoster(){
  const list=$('adm-roster');if(!list)return;
  list.replaceChildren();
  const countEl=$('adm-count');
  if(countEl){
   const loginCount=workingRoster.filter(r=>r.password).length;
   countEl.textContent=workingRoster.length+' drivers · '+loginCount+' logins'+(hasLocalOverride()?' · local override active':'');
  }
  workingRoster.forEach((person,idx)=>{
   const row=document.createElement('div');row.className='adm-user-row';
   const info=document.createElement('div');info.className='adm-user-info';
   const name=document.createElement('strong');name.textContent=person.name;
   const meta=document.createElement('span');meta.className='adm-user-meta';
   const parts=[];
   if(person.password)parts.push('Login: '+(showPasswords?person.password:'•••••'));
   else parts.push('Driver only (no login)');
   if(person.portrait)parts.push('Portrait');
   meta.textContent=parts.join(' · ');
   info.append(name,meta);

   const actions=document.createElement('div');actions.className='adm-user-actions';
   const editBtn=document.createElement('button');editBtn.type='button';editBtn.className='btn btn-outline adm-sm';editBtn.textContent='Edit';
   editBtn.addEventListener('click',()=>{
    const newPass=prompt('Login password for '+person.name+' (leave blank for driver-only, no login):',person.password||'');
    if(newPass===null)return;
    const trimmed=newPass.trim();
    if(person.name===ADMIN_USER&&!trimmed){toast('Admin account must keep a password');return}
    if(trimmed)workingRoster[idx].password=trimmed;else delete workingRoster[idx].password;
    saveLocalOverride(workingRoster);
    setStatus('Updated '+person.name+' locally. Tap "Publish to GitHub" to push to all phones.');
    render();
   });
   actions.append(editBtn);

   if(person.name!==ADMIN_USER){
    const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='btn btn-outline adm-sm adm-danger';delBtn.textContent='Remove';
    delBtn.addEventListener('click',()=>{
     if(!confirm('Remove '+person.name+' from the roster?'))return;
     workingRoster.splice(idx,1);
     saveLocalOverride(workingRoster);
     setStatus('Removed '+person.name+' locally. Tap "Publish to GitHub" to push to all phones.');
     render();
    });
    actions.append(delBtn);
   }
   row.append(info,actions);
   list.append(row);
  });
 }

 function renderDiagnostics(){
  const box=$('adm-diag');if(!box)return;
  const stats=storageStats();
  const inApp=!!root.MDSNative||/\bMDSTimesheetApp\//.test(navigator.userAgent||'');
  const rows=[
   ['Signed in as',currentUser()],
   ['Environment',inApp?'Android App ('+(root.MDSNative?.appVersion?.()||'?')+')':'Web Browser'],
   ['Local storage',stats.kb+' KB'],
   ['Saved weeks on phone',stats.empWeeks.length?stats.empWeeks.join(', '):'None yet'],
  ];
  box.replaceChildren();
  rows.forEach(([k,v])=>{
   const d=document.createElement('div');d.className='adm-diag-row';
   const a=document.createElement('span');a.textContent=k;
   const b=document.createElement('strong');b.textContent=v;
   d.append(a,b);box.append(d);
  });
 }

 function render(){
  if(!panel)return;
  renderRoster();
  renderDiagnostics();
  const resetBtn=$('adm-reset-local');
  if(resetBtn)resetBtn.hidden=!hasLocalOverride();
  const tokenState=$('adm-token-state');
  if(tokenState)tokenState.textContent=read(TOKEN_KEY)?'Connected (saved on this device only)':'Not connected';
  const showBtn=$('adm-toggle-pw');
  if(showBtn)showBtn.textContent=showPasswords?'Hide passwords':'Show passwords';
 }

 function buildPanel(){
  const sec=document.createElement('section');sec.id='section-admin';sec.className='adm-section';sec.hidden=true;
  sec.innerHTML=
   '<div class="card">'
    +'<div class="adm-head"><div><h2>Admin — Users &amp; Drivers</h2><p id="adm-count" class="adm-sub"></p></div>'
    +'<button type="button" class="btn btn-outline adm-sm" id="adm-toggle-pw">Show passwords</button></div>'
    +'<p id="adm-status" class="adm-status" role="status" hidden></p>'
    +'<div id="adm-roster" class="adm-roster"></div>'
    +'<form id="adm-add-form" class="adm-add-form">'
     +'<h3>Add user or driver</h3>'
     +'<div class="field"><label for="adm-new-name">Full name</label><input id="adm-new-name" type="text" placeholder="e.g. Sam Taylor" required></div>'
     +'<div class="field"><label for="adm-new-pass">Login password <small>(leave blank for driver-only)</small></label>'
      +'<div class="adm-pass-row"><input id="adm-new-pass" type="text" placeholder="e.g. st482"><button type="button" class="btn btn-outline adm-sm" id="adm-gen-pass">Generate</button></div>'
     +'</div>'
     +'<button type="submit" class="btn btn-primary">Add to roster</button>'
    +'</form>'
   +'</div>'
   +'<div class="card">'
    +'<h2>Publish changes to all phones</h2>'
    +'<p class="adm-sub">Edits above apply immediately on this phone. Publish to GitHub so every other driver gets the update automatically.</p>'
    +'<div class="adm-actions">'
     +'<button type="button" class="btn btn-primary" id="adm-publish">Publish to GitHub</button>'
     +'<button type="button" class="btn btn-outline" id="adm-copy-js">Copy drivers.js</button>'
     +'<button type="button" class="btn btn-outline" id="adm-copy-logins">Copy login list</button>'
     +'<button type="button" class="btn btn-outline adm-danger" id="adm-reset-local" hidden>Reset local override</button>'
    +'</div>'
    +'<details class="adm-token-box"><summary>GitHub token (<span id="adm-token-state"></span>)</summary>'
     +'<p class="adm-sub">Create a fine-grained Personal Access Token on GitHub scoped <strong>only</strong> to <code>'+GH_REPO+'</code> with <strong>Contents: Read and write</strong>. It stays in this phone’s storage only.</p>'
     +'<div class="adm-pass-row"><input id="adm-token-input" type="password" placeholder="github_pat_…"><button type="button" class="btn btn-primary adm-sm" id="adm-save-token">Save</button><button type="button" class="btn btn-outline adm-sm" id="adm-clear-token">Clear</button></div>'
    +'</details>'
   +'</div>'
   +'<div class="card">'
    +'<h2>Device &amp; Maintenance</h2>'
    +'<div id="adm-diag" class="adm-diag"></div>'
    +'<div class="adm-actions">'
     +'<button type="button" class="btn btn-outline" id="adm-force-refresh">Clear app cache &amp; reload</button>'
     +'<button type="button" class="btn btn-outline" id="adm-open-theme">Appearance &amp; feature toggles</button>'
    +'</div>'
   +'</div>';

  sec.querySelector('#adm-toggle-pw').addEventListener('click',()=>{showPasswords=!showPasswords;render()});
  sec.querySelector('#adm-gen-pass').addEventListener('click',()=>{
   const name=sec.querySelector('#adm-new-name').value.trim();
   sec.querySelector('#adm-new-pass').value=generatePassword(name||'md');
  });
  sec.querySelector('#adm-add-form').addEventListener('submit',e=>{
   e.preventDefault();
   const nameInp=sec.querySelector('#adm-new-name'),passInp=sec.querySelector('#adm-new-pass');
   const name=nameInp.value.trim(),password=passInp.value.trim();
   if(!name)return;
   if(workingRoster.some(r=>r.name.toLowerCase()===name.toLowerCase())){toast(name+' is already in the roster');return}
   const entry={name};
   if(password)entry.password=password;
   workingRoster.push(entry);
   saveLocalOverride(workingRoster);
   nameInp.value='';passInp.value='';
   setStatus('Added '+name+' locally. Tap "Publish to GitHub" to push to all phones.');
   render();
  });
  sec.querySelector('#adm-publish').addEventListener('click',publishToGitHub);
  sec.querySelector('#adm-copy-js').addEventListener('click',copyDriversFile);
  sec.querySelector('#adm-copy-logins').addEventListener('click',copyLogins);
  sec.querySelector('#adm-reset-local').addEventListener('click',()=>{
   if(!confirm('Discard local roster edits and reload the published roster?'))return;
   clearLocalOverride();setStatus('Local override cleared.');render();
  });
  sec.querySelector('#adm-save-token').addEventListener('click',()=>{
   const val=sec.querySelector('#adm-token-input').value.trim();
   if(!val){toast('Paste a GitHub token first');return}
   write(TOKEN_KEY,val);sec.querySelector('#adm-token-input').value='';
   toast('GitHub token saved on this device');render();
  });
  sec.querySelector('#adm-clear-token').addEventListener('click',()=>{
   write(TOKEN_KEY,null);toast('GitHub token removed');render();
  });
  sec.querySelector('#adm-force-refresh').addEventListener('click',forceRefreshApp);
  sec.querySelector('#adm-open-theme').addEventListener('click',()=>{
   $('app-theme-button')?.click();
  });
  return sec;
 }

 function syncVisibility(){
  const sel=$('sectionSelect');if(!sel||!panel)return;
  const allowed=isAdmin(currentUser());
  if(allowed){
   if(!option){option=document.createElement('option');option.value='admin';option.textContent='Admin'}
   if(!option.isConnected)sel.append(option);
  }else{
   if(option&&option.isConnected)option.remove();
   panel.hidden=true;
   if(sel.value==='admin'&&typeof root.switchSection==='function'){
    sel.value='ts';root.switchSection('ts');
   }
  }
 }

 function boot(){
  if(!$('sectionSelect')||typeof root.switchSection!=='function'||$('section-admin'))return;
  syncWorkingFromLive();
  panel=buildPanel();
  ($('section-tools')||$('section-expenses')||$('section-holiday')).after(panel);

  const origSwitch=root.switchSection;
  root.switchSection=function(section){
   if(section==='admin'&&!isAdmin(currentUser()))section='ts';
   origSwitch(section);
   panel.hidden=section!=='admin';
   if(section==='admin'){syncWorkingFromLive();render();scrollTo(0,0)}
  };
  const origLogout=root.doLogout;
  if(typeof origLogout==='function'){
   root.doLogout=function(){origLogout();syncVisibility()};
  }
  const origLogin=root.doLogin;
  if(typeof origLogin==='function'){
   root.doLogin=function(){origLogin();syncVisibility()};
  }

  syncVisibility();
  if(read('ts_section')==='admin'&&isAdmin(currentUser())){
   $('sectionSelect').value='admin';
   root.switchSection('admin');
  }
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
 root.addEventListener('load',boot);
})(typeof window==='undefined'?globalThis:window);
