// Admin page: users & drivers, portrait uploader, company vans, per-driver feature rollouts,
// driver notice banner, company rate defaults, and one-tap GitHub publishing.
// Strictly restricted to Jak Stewart — completely hidden from all other users.
(function(root){
 'use strict';
 const ADMIN_USER='Jak Stewart';
 const APP_URL='https://jakstew93-oss.github.io/mdstimesheet/';
 const GH_REPO='jakstew93-oss/mdstimesheet';
 const GH_BRANCH='main';
 const TOKEN_KEY='mds_admin_gh_token';

 function isAdmin(user){return user===ADMIN_USER}

 function slugify(name){
  return String(name||'driver').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'driver';
 }

 function generatePassword(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  const initials=(parts.length>=2?parts[0][0]+parts[parts.length-1][0]:(parts[0]||'md').slice(0,2)).toLowerCase().replace(/[^a-z]/g,'x');
  const num=String(100+Math.floor(Math.random()*900));
  return initials+num;
 }

 function shareLoginText(name,password){
  return 'MDS Timesheet\n'+APP_URL+'\n\nName: '+name+'\nPassword: '+password;
 }

 function formatRosterLines(roster){
  return roster.map(r=>{
   const fields=['name:'+JSON.stringify(r.name)];
   if(r.password)fields.push('password:'+JSON.stringify(r.password));
   if(r.portrait)fields.push('portrait:'+JSON.stringify(r.portrait));
   return '  {'+fields.join(', ')+'},';
  }).join('\n');
 }

 function updateDriversSource(currentSource,roster){
  const re=/(const BASE_ROSTER=\[\n)([\s\S]*?)(\n \];)/;
  if(!re.test(currentSource))throw new Error('Could not locate BASE_ROSTER in drivers.js');
  return currentSource.replace(re,'$1'+formatRosterLines(roster)+'$3');
 }

 function formatSiteConfigBody(cfg){
  const lines=[];
  lines.push('  fleet:[');
  for(const [reg,label] of cfg.fleet)lines.push('   ['+JSON.stringify(reg)+','+JSON.stringify(label)+'],');
  lines.push('  ],');
  lines.push('  features:{');
  lines.push('   payEstimate:'+JSON.stringify(cfg.features.payEstimate)+',');
  lines.push('   shiftDial:'+JSON.stringify(cfg.features.shiftDial)+',');
  lines.push('   sundayReminder:'+JSON.stringify(cfg.features.sundayReminder)+',');
  lines.push('  },');
  lines.push('  rates:{');
  lines.push('   mileage:'+cfg.rates.mileage+',');
  lines.push('   night:'+cfg.rates.night+',');
  lines.push('   holidayHours:'+cfg.rates.holidayHours+',');
  lines.push('   satX:'+cfg.rates.satX+',');
  lines.push('   sunX:'+cfg.rates.sunX+',');
  lines.push('  },');
  lines.push('  notice:{');
  lines.push('   id:'+JSON.stringify(cfg.notice.id)+',');
  lines.push('   text:'+JSON.stringify(cfg.notice.text)+',');
  lines.push('   expires:'+JSON.stringify(cfg.notice.expires)+',');
  lines.push('  },');
  return lines.join('\n');
 }

 function updateSiteConfigSource(currentSource,cfg){
  const re=/(const BASE_CONFIG=\{\n)([\s\S]*?)(\n \};)/;
  if(!re.test(currentSource))throw new Error('Could not locate BASE_CONFIG in site-config.js');
  return currentSource.replace(re,'$1'+formatSiteConfigBody(cfg)+'$3');
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

 const api={
  ADMIN_USER,APP_URL,GH_REPO,GH_BRANCH,
  isAdmin,slugify,generatePassword,shareLoginText,
  formatRosterLines,updateDriversSource,
  formatSiteConfigBody,updateSiteConfigSource,
 };
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSAdmin=api;
 if(!root.document)return;

 const $=id=>document.getElementById(id);
 const read=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
 const write=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}};
 const toast=m=>{if(typeof showToast==='function')showToast(m)};
 const currentUser=()=>read('ts_auth_user')||'';

 let panel=null,option=null,workingRoster=[],workingConfig=null,pendingPortraits={},showPasswords=false,busy=false;

 function cloneConfig(c){
  const src=c||root.MDS_CONFIG;
  return {
   fleet:(src?.fleet||[]).map(p=>[...p]),
   features:{
    payEstimate:[...(src?.features?.payEstimate||[])],
    shiftDial:[...(src?.features?.shiftDial||[])],
    sundayReminder:[...(src?.features?.sundayReminder||[])],
   },
   rates:{...(src?.rates||{mileage:0.25,night:20,holidayHours:8,satX:1.5,sunX:1.5})},
   notice:{...(src?.notice||{id:'',text:'',expires:''})},
  };
 }

 function syncWorkingFromLive(){
  const d=root.MDS_DRIVERS;
  workingRoster=d?d.ROSTER.map(r=>({...r})):[];
  workingConfig=cloneConfig(root.MDS_CONFIG);
 }

 function saveLocalRoster(roster){
  const d=root.MDS_DRIVERS;if(!d)return;
  write(d.OVERRIDE_KEY,JSON.stringify(roster));
  d.applyRoster(roster);
 }

 function saveLocalConfig(cfg){
  const c=root.MDS_CONFIG;if(!c)return;
  write(c.OVERRIDE_KEY,JSON.stringify(cfg));
  c.applyConfig(cfg);
 }

 function hasLocalOverrides(){
  const d=root.MDS_DRIVERS,c=root.MDS_CONFIG;
  return !!((d&&read(d.OVERRIDE_KEY))||(c&&read(c.OVERRIDE_KEY))||Object.keys(pendingPortraits).length);
 }

 function clearAllLocalOverrides(){
  const d=root.MDS_DRIVERS,c=root.MDS_CONFIG;
  if(d){write(d.OVERRIDE_KEY,null);d.applyRoster(d.BASE_ROSTER)}
  if(c){write(c.OVERRIDE_KEY,null);c.applyConfig(c.BASE_CONFIG)}
  pendingPortraits={};
  syncWorkingFromLive();
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

 function resizePortraitToPngBase64(file){
  return new Promise((resolve,reject)=>{
   const url=URL.createObjectURL(file);
   const img=new Image();
   img.onload=()=>{
    URL.revokeObjectURL(url);
    const max=256,scale=Math.min(1,max/Math.max(img.width||1,img.height||1));
    const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(img,0,0,w,h);
    const dataUrl=canvas.toDataURL('image/png');
    resolve(dataUrl.split(',')[1]||'');
   };
   img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not read that image'))};
   img.src=url;
  });
 }

 async function ghHeaders(token){
  return {'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 }

 async function ghGetFile(token,filePath){
  const url='https://api.github.com/repos/'+GH_REPO+'/contents/'+filePath+'?ref='+GH_BRANCH;
  const res=await fetch(url,{headers:await ghHeaders(token)});
  if(res.status===404)return null;
  if(!res.ok)throw new Error('GitHub read failed for '+filePath+' ('+res.status+')');
  return res.json();
 }

 async function ghPutFile(token,filePath,contentBase64,message,sha){
  const url='https://api.github.com/repos/'+GH_REPO+'/contents/'+filePath;
  const body={message,content:contentBase64,branch:GH_BRANCH};
  if(sha)body.sha=sha;
  const res=await fetch(url,{
   method:'PUT',
   headers:{...(await ghHeaders(token)),'Content-Type':'application/json'},
   body:JSON.stringify(body),
  });
  if(!res.ok){
   const errText=await res.text().catch(()=>'');
   throw new Error('GitHub commit failed for '+filePath+' ('+res.status+'): '+errText.slice(0,120));
  }
  return res.json();
 }

 async function publishAllToGitHub(){
  const token=(read(TOKEN_KEY)||'').trim();
  if(!token){toast('Add a GitHub token below first');return}
  if(busy)return;
  busy=true;setStatus('Publishing changes to GitHub…');
  try{
   const published=[];
   // 1. Upload any queued portraits
   for(const [slug,b64] of Object.entries(pendingPortraits)){
    const path='driver-avatars/'+slug+'.png';
    setStatus('Uploading portrait '+path+'…');
    const existing=await ghGetFile(token,path);
    await ghPutFile(token,path,b64,'Upload portrait '+slug+' via Admin page',existing&&existing.sha);
    published.push(path);
   }
   pendingPortraits={};

   // 2. Update drivers.js if changed
   const driversFile=await ghGetFile(token,'drivers.js');
   if(driversFile){
    const curSrc=fromBase64Utf8(driversFile.content);
    const nextSrc=updateDriversSource(curSrc,workingRoster);
    if(nextSrc!==curSrc){
     setStatus('Publishing drivers.js…');
     await ghPutFile(token,'drivers.js',toBase64Utf8(nextSrc),'Update driver roster via Admin page',driversFile.sha);
     published.push('drivers.js');
    }
   }

   // 3. Update site-config.js if changed
   const cfgFile=await ghGetFile(token,'site-config.js');
   if(cfgFile){
    const curSrc=fromBase64Utf8(cfgFile.content);
    const nextSrc=updateSiteConfigSource(curSrc,workingConfig);
    if(nextSrc!==curSrc){
     setStatus('Publishing site-config.js…');
     await ghPutFile(token,'site-config.js',toBase64Utf8(nextSrc),'Update company config via Admin page',cfgFile.sha);
     published.push('site-config.js');
    }
   }

   if(!published.length){
    setStatus('Everything is already up to date on GitHub.');
   }else{
    saveLocalRoster(workingRoster);
    saveLocalConfig(workingConfig);
    setStatus('Published '+published.join(', ')+' to GitHub! Every phone will update within ~1 minute.');
    toast('Published to GitHub');
   }
   render();
  }catch(err){
   setStatus('Publish failed: '+(err.message||err),true);
  }finally{
   busy=false;
  }
 }

 async function shareLogin(person){
  const text=shareLoginText(person.name,person.password);
  try{
   if(navigator.share){
    await navigator.share({title:'MDS Timesheet Login — '+person.name,text});
    return;
   }
  }catch(_){}
  try{
   await navigator.clipboard.writeText(text);
   toast('Login message for '+person.name+' copied');
  }catch(_){
   prompt('Copy login details:',text);
  }
 }

 async function copyLogins(){
  const lines=workingRoster.filter(r=>r.password).map(r=>r.name+': '+r.password).join('\n');
  try{await navigator.clipboard.writeText(lines);toast('Login list copied to clipboard')}
  catch(_){toast('Could not copy login list')}
 }

 async function forceRefreshApp(){
  if(!confirm('Clear cached app files and reload? Your saved timesheets, expenses and settings will NOT be deleted.'))return;
  try{
   if('caches' in root){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}
   if(navigator.serviceWorker){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}
  }catch(_){}
  location.reload();
 }

 function setStatus(msg,isErr){
  const el=$('adm-status');if(!el)return;
  el.textContent=msg||'';
  el.classList.toggle('adm-err',!!isErr);
  el.hidden=!msg;
 }

 function toggleFeature(featureKey,userName,on){
  const list=workingConfig.features[featureKey]||[];
  const set=new Set(list);
  if(on)set.add(userName);else set.delete(userName);
  workingConfig.features[featureKey]=[...set];
  saveLocalConfig(workingConfig);
  setStatus('Updated feature defaults for '+userName+'. Tap "Publish all changes to GitHub" when ready.');
 }

 function renderRoster(){
  const list=$('adm-roster');if(!list)return;
  list.replaceChildren();
  const countEl=$('adm-count');
  if(countEl){
   const loginCount=workingRoster.filter(r=>r.password).length;
   const queued=Object.keys(pendingPortraits).length;
   countEl.textContent=workingRoster.length+' drivers · '+loginCount+' logins'+(queued?' · '+queued+' portrait'+(queued>1?'s':'')+' queued':'')+(hasLocalOverrides()?' · unpublished changes':'');
  }
  workingRoster.forEach((person,idx)=>{
   const row=document.createElement('div');row.className='adm-user-row';
   const info=document.createElement('div');info.className='adm-user-info';
   const name=document.createElement('strong');name.textContent=person.name;
   const meta=document.createElement('span');meta.className='adm-user-meta';
   const parts=[];
   if(person.password)parts.push('Login: '+(showPasswords?person.password:'•••••'));
   else parts.push('Driver only (no login)');
   if(person.portrait)parts.push(pendingPortraits[person.portrait]?'New photo queued':'Portrait');
   meta.textContent=parts.join(' · ');
   info.append(name,meta);

   const actions=document.createElement('div');actions.className='adm-user-actions';
   if(person.password){
    const shareBtn=document.createElement('button');shareBtn.type='button';shareBtn.className='btn btn-outline adm-sm';shareBtn.textContent='Share';
    shareBtn.addEventListener('click',()=>shareLogin(person));
    actions.append(shareBtn);
   }
   const photoBtn=document.createElement('button');photoBtn.type='button';photoBtn.className='btn btn-outline adm-sm';photoBtn.textContent='Photo';
   photoBtn.addEventListener('click',()=>{
    const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
    inp.addEventListener('change',async()=>{
     const file=inp.files&&inp.files[0];if(!file)return;
     try{
      const b64=await resizePortraitToPngBase64(file);
      const slug=person.portrait||slugify(person.name);
      pendingPortraits[slug]=b64;
      workingRoster[idx].portrait=slug;
      saveLocalRoster(workingRoster);
      setStatus('Portrait ready for '+person.name+' ('+slug+'.png). Tap "Publish all changes to GitHub" to upload.');
      render();
     }catch(err){toast(err.message||'Could not load image')}
    });
    inp.click();
   });
   actions.append(photoBtn);

   const editBtn=document.createElement('button');editBtn.type='button';editBtn.className='btn btn-outline adm-sm';editBtn.textContent='Edit';
   editBtn.addEventListener('click',()=>{
    const newPass=prompt('Login password for '+person.name+' (leave blank for driver-only, no login):',person.password||'');
    if(newPass===null)return;
    const trimmed=newPass.trim();
    if(person.name===ADMIN_USER&&!trimmed){toast('Admin account must keep a password');return}
    if(trimmed)workingRoster[idx].password=trimmed;else delete workingRoster[idx].password;
    saveLocalRoster(workingRoster);
    setStatus('Updated '+person.name+' locally. Tap "Publish all changes to GitHub" to push to all phones.');
    render();
   });
   actions.append(editBtn);

   if(person.name!==ADMIN_USER){
    const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='btn btn-outline adm-sm adm-danger';delBtn.textContent='Remove';
    delBtn.addEventListener('click',()=>{
     if(!confirm('Remove '+person.name+' from the roster?'))return;
     workingRoster.splice(idx,1);
     saveLocalRoster(workingRoster);
     setStatus('Removed '+person.name+' locally. Tap "Publish all changes to GitHub" to push to all phones.');
     render();
    });
    actions.append(delBtn);
   }
   row.append(info,actions);
   list.append(row);
  });
 }

 function renderFleet(){
  const list=$('adm-fleet');if(!list)return;
  list.replaceChildren();
  workingConfig.fleet.forEach(([reg,label],idx)=>{
   const row=document.createElement('div');row.className='adm-user-row';
   const info=document.createElement('div');info.className='adm-user-info';
   const title=document.createElement('strong');title.textContent=reg;
   const sub=document.createElement('span');sub.className='adm-user-meta';sub.textContent=label||'No label';
   info.append(title,sub);
   const actions=document.createElement('div');actions.className='adm-user-actions';
   const editBtn=document.createElement('button');editBtn.type='button';editBtn.className='btn btn-outline adm-sm';editBtn.textContent='Rename';
   editBtn.addEventListener('click',()=>{
    const next=prompt('Label for '+reg+':',label||'');
    if(next===null)return;
    workingConfig.fleet[idx]=[reg,next.trim()];
    saveLocalConfig(workingConfig);
    setStatus('Updated van '+reg+' locally. Tap "Publish all changes to GitHub" to push.');
    render();
   });
   const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='btn btn-outline adm-sm adm-danger';delBtn.textContent='Remove';
   delBtn.addEventListener('click',()=>{
    if(workingConfig.fleet.length<=1){toast('Keep at least one company van');return}
    if(!confirm('Remove '+reg+' from the company fleet?'))return;
    workingConfig.fleet.splice(idx,1);
    saveLocalConfig(workingConfig);
    setStatus('Removed van '+reg+' locally. Tap "Publish all changes to GitHub" to push.');
    render();
   });
   actions.append(editBtn,delBtn);
   row.append(info,actions);
   list.append(row);
  });
 }

 function renderRollouts(){
  const box=$('adm-rollouts');if(!box)return;
  box.replaceChildren();
  const loginUsers=workingRoster.filter(r=>r.password);
  const feats=[['payEstimate','Pay'],['shiftDial','Dial'],['sundayReminder','Sun']];
  const head=document.createElement('div');head.className='adm-rollout-row adm-rollout-head';
  head.innerHTML='<span>Driver</span>'+feats.map(([,l])=>'<span>'+l+'</span>').join('');
  box.append(head);
  for(const person of loginUsers){
   const row=document.createElement('div');row.className='adm-rollout-row';
   const name=document.createElement('span');name.textContent=person.name;
   row.append(name);
   for(const [key,label] of feats){
    const cell=document.createElement('label');cell.className='adm-chk';
    const cb=document.createElement('input');cb.type='checkbox';
    cb.checked=(workingConfig.features[key]||[]).includes(person.name);
    cb.setAttribute('aria-label',label+' default for '+person.name);
    cb.addEventListener('change',()=>toggleFeature(key,person.name,cb.checked));
    cell.append(cb);row.append(cell);
   }
   box.append(row);
  }
 }

 function renderNoticeForm(){
  const textInp=$('adm-notice-text'),expInp=$('adm-notice-exp');
  if(textInp&&document.activeElement!==textInp)textInp.value=workingConfig.notice.text||'';
  if(expInp&&document.activeElement!==expInp)expInp.value=workingConfig.notice.expires||'';
 }

 function renderRatesForm(){
  const fields=[['adm-rate-mileage','mileage'],['adm-rate-night','night'],['adm-rate-hol','holidayHours'],['adm-rate-sat','satX'],['adm-rate-sun','sunX']];
  for(const [id,key] of fields){
   const el=$(id);
   if(el&&document.activeElement!==el)el.value=String(workingConfig.rates[key]);
  }
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
  renderFleet();
  renderRollouts();
  renderNoticeForm();
  renderRatesForm();
  renderDiagnostics();
  const resetBtn=$('adm-reset-local');
  if(resetBtn)resetBtn.hidden=!hasLocalOverrides();
  const tokenState=$('adm-token-state');
  if(tokenState)tokenState.textContent=read(TOKEN_KEY)?'Connected (saved on this device only)':'Not connected';
  const showBtn=$('adm-toggle-pw');
  if(showBtn)showBtn.textContent=showPasswords?'Hide passwords':'Show passwords';
 }

 function buildPanel(){
  const sec=document.createElement('section');sec.id='section-admin';sec.className='adm-section';sec.hidden=true;
  sec.innerHTML=
   '<div class="card">'
    +'<h2>Publish to all phones</h2>'
    +'<p id="adm-status" class="adm-status" role="status" hidden></p>'
    +'<p class="adm-sub">All edits below apply immediately on this phone. Tap Publish to push roster, vans, portraits, notices, feature defaults and rates to GitHub for everyone.</p>'
    +'<div class="adm-actions">'
     +'<button type="button" class="btn btn-primary" id="adm-publish">Publish all changes to GitHub</button>'
     +'<button type="button" class="btn btn-outline" id="adm-copy-logins">Copy login list</button>'
     +'<button type="button" class="btn btn-outline adm-danger" id="adm-reset-local" hidden>Reset local edits</button>'
    +'</div>'
    +'<details class="adm-token-box"><summary>GitHub token (<span id="adm-token-state"></span>)</summary>'
     +'<p class="adm-sub">Create a fine-grained Personal Access Token on GitHub scoped <strong>only</strong> to <code>'+GH_REPO+'</code> with <strong>Contents: Read and write</strong>. It stays in this phone’s storage only.</p>'
     +'<div class="adm-pass-row"><input id="adm-token-input" type="password" placeholder="github_pat_…"><button type="button" class="btn btn-primary adm-sm" id="adm-save-token">Save</button><button type="button" class="btn btn-outline adm-sm" id="adm-clear-token">Clear</button></div>'
    +'</details>'
   +'</div>'

   +'<div class="card">'
    +'<div class="adm-head"><div><h2>Users &amp; Drivers</h2><p id="adm-count" class="adm-sub"></p></div>'
    +'<button type="button" class="btn btn-outline adm-sm" id="adm-toggle-pw">Show passwords</button></div>'
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
    +'<h2>Driver Notice Banner</h2>'
    +'<p class="adm-sub">Show a dismissible message at the top of the app for all drivers.</p>'
    +'<div class="field"><label for="adm-notice-text">Message</label><textarea id="adm-notice-text" rows="2" placeholder="e.g. Bank holiday Monday — submit timesheets by Friday 4pm."></textarea></div>'
    +'<div class="field"><label for="adm-notice-exp">Auto-hide after date <small>(optional)</small></label><input id="adm-notice-exp" type="date"></div>'
    +'<div class="adm-actions">'
     +'<button type="button" class="btn btn-primary" id="adm-notice-save">Save notice</button>'
     +'<button type="button" class="btn btn-outline" id="adm-notice-clear">Clear notice</button>'
    +'</div>'
   +'</div>'

   +'<div class="card">'
    +'<h2>Company Vans</h2>'
    +'<p class="adm-sub">Fleet vans shown in every driver’s vehicle dropdown.</p>'
    +'<div id="adm-fleet" class="adm-roster"></div>'
    +'<form id="adm-van-form" class="adm-add-form">'
     +'<h3>Add company van</h3>'
     +'<div class="adm-pass-row" style="margin-bottom:10px">'
      +'<input id="adm-van-reg" type="text" placeholder="Reg (e.g. AB24 CDE)" required>'
      +'<input id="adm-van-label" type="text" placeholder="Label (e.g. Sam’s Van)">'
     +'</div>'
     +'<button type="submit" class="btn btn-primary">Add van</button>'
    +'</form>'
   +'</div>'

   +'<div class="card">'
    +'<h2>Feature Rollouts (Defaults)</h2>'
    +'<p class="adm-sub">Choose who gets Pay Estimate, Shift Dial, and Sunday Reminder turned on by default. Drivers can still toggle them in Appearance.</p>'
    +'<div id="adm-rollouts" class="adm-rollouts"></div>'
   +'</div>'

   +'<div class="card">'
    +'<h2>Company Rate Defaults</h2>'
    +'<p class="adm-sub">Default rates used for expenses and new pay estimate setups.</p>'
    +'<div class="adm-rates-grid">'
     +'<label class="adm-rate-field"><span>Mileage (£/mile)</span><input id="adm-rate-mileage" type="number" step="0.01" min="0"></label>'
     +'<label class="adm-rate-field"><span>Night away (£)</span><input id="adm-rate-night" type="number" step="0.5" min="0"></label>'
     +'<label class="adm-rate-field"><span>Holiday day (hrs)</span><input id="adm-rate-hol" type="number" step="0.5" min="0"></label>'
     +'<label class="adm-rate-field"><span>Saturday (×)</span><input id="adm-rate-sat" type="number" step="0.1" min="0"></label>'
     +'<label class="adm-rate-field"><span>Sunday (×)</span><input id="adm-rate-sun" type="number" step="0.1" min="0"></label>'
    +'</div>'
    +'<button type="button" class="btn btn-primary" id="adm-rates-save" style="margin-top:10px">Save rate defaults</button>'
   +'</div>'

   +'<div class="card">'
    +'<h2>Device &amp; Maintenance</h2>'
    +'<div id="adm-diag" class="adm-diag"></div>'
    +'<div class="adm-actions">'
     +'<button type="button" class="btn btn-outline" id="adm-force-refresh">Clear app cache &amp; reload</button>'
     +'<button type="button" class="btn btn-outline" id="adm-open-theme">Appearance &amp; feature toggles</button>'
    +'</div>'
   +'</div>';

  sec.querySelector('#adm-publish').addEventListener('click',publishAllToGitHub);
  sec.querySelector('#adm-copy-logins').addEventListener('click',copyLogins);
  sec.querySelector('#adm-reset-local').addEventListener('click',()=>{
   if(!confirm('Discard local unpublished edits and reload the published config?'))return;
   clearAllLocalOverrides();setStatus('Local edits cleared.');render();
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
   saveLocalRoster(workingRoster);
   nameInp.value='';passInp.value='';
   setStatus('Added '+name+' locally. Tap "Publish all changes to GitHub" to push to all phones.');
   render();
  });

  sec.querySelector('#adm-notice-save').addEventListener('click',()=>{
   const text=sec.querySelector('#adm-notice-text').value.trim();
   const expires=sec.querySelector('#adm-notice-exp').value.trim();
   workingConfig.notice={id:text?'n-'+Date.now().toString(36):'',text,expires};
   if(root.MDS_CONFIG)write(root.MDS_CONFIG.DISMISSED_KEY,null);
   saveLocalConfig(workingConfig);
   setStatus(text?'Notice saved locally. Tap "Publish all changes to GitHub" to show it to all drivers.':'Notice cleared locally.');
   render();
  });
  sec.querySelector('#adm-notice-clear').addEventListener('click',()=>{
   workingConfig.notice={id:'',text:'',expires:''};
   saveLocalConfig(workingConfig);
   setStatus('Notice cleared locally. Tap "Publish all changes to GitHub" to clear it on all phones.');
   render();
  });

  sec.querySelector('#adm-van-form').addEventListener('submit',e=>{
   e.preventDefault();
   const regInp=sec.querySelector('#adm-van-reg'),lblInp=sec.querySelector('#adm-van-label');
   const tidy=root.MDSVehicleRegs?.tidy||(v=>String(v||'').toUpperCase().trim());
   const reg=tidy(regInp.value),label=lblInp.value.trim();
   if(!reg)return;
   if(workingConfig.fleet.some(([r])=>r.replace(/\s+/g,'')===reg.replace(/\s+/g,''))){toast(reg+' is already in the fleet');return}
   workingConfig.fleet.push([reg,label]);
   saveLocalConfig(workingConfig);
   regInp.value='';lblInp.value='';
   setStatus('Added van '+reg+' locally. Tap "Publish all changes to GitHub" to push.');
   render();
  });

  sec.querySelector('#adm-rates-save').addEventListener('click',()=>{
   const num=(id,fb)=>{const n=Number(sec.querySelector('#'+id).value);return Number.isFinite(n)&&n>=0?n:fb};
   workingConfig.rates={
    mileage:num('adm-rate-mileage',workingConfig.rates.mileage),
    night:num('adm-rate-night',workingConfig.rates.night),
    holidayHours:num('adm-rate-hol',workingConfig.rates.holidayHours),
    satX:num('adm-rate-sat',workingConfig.rates.satX),
    sunX:num('adm-rate-sun',workingConfig.rates.sunX),
   };
   saveLocalConfig(workingConfig);
   setStatus('Company rate defaults saved locally. Tap "Publish all changes to GitHub" to push.');
   render();
  });

  sec.querySelector('#adm-force-refresh').addEventListener('click',forceRefreshApp);
  sec.querySelector('#adm-open-theme').addEventListener('click',()=>{$('app-theme-button')?.click()});
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
  if(typeof origLogout==='function')root.doLogout=function(){origLogout();syncVisibility()};
  const origLogin=root.doLogin;
  if(typeof origLogin==='function')root.doLogin=function(){origLogin();syncVisibility()};

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
