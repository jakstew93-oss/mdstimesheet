// Shared by manual entry, editing and Quick Start saves.
window.calcHours = function(start, end) {
 if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start || '') ||
     !/^([01]\d|2[0-3]):[0-5]\d$/.test(end || '')) return '';
 const [sh, sm] = start.split(':').map(Number);
 const [eh, em] = end.split(':').map(Number);
 let minutes = eh * 60 + em - (sh * 60 + sm);
 // An earlier finish belongs to the following calendar day.
 if (minutes < 0) minutes += 1440;
 return minutes > 0 ? minsToStr(minutes) : '';
};

(function(){
 'use strict';
 const api=window.MDSTools;
 let bypassExport=false;
 const $=id=>document.getElementById(id);
 function draft(){return JSON.parse(localStorage.getItem('mds_qs_draft')||'{}')||{}}
 function workingDraft(){const d=draft();return ['jobNumber',...api.timeFields,'food','hol'].some(k=>!!d[k])}
 function week(){return localStorage.getItem(getWeekKey())||currentWeekEnding()}
 function weekLabel(value){return new Date(value+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
 function storageKey(name){return name+empSuffix()}
 function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
 function button(text,action){const node=element('button',text);node.type='button';node.addEventListener('click',action);return node}
 function dialog(title){
  let d=$('workflow-dialog');if(!d){d=element('dialog',undefined,'workflow-dialog');d.id='workflow-dialog';document.body.append(d)}
  d.replaceChildren();d.setAttribute('aria-labelledby','workflow-dialog-title');const h=element('h2',title);h.id='workflow-dialog-title';d.append(h);
  if(!d.open)d.showModal();return d;
 }
 function selectWeek(value){
  if(workingDraft()){showToast('Save or reset your Quick Start entry before switching weeks');return false}
  const data=readWeekStore();if(!data.weeks[value]){data.weeks[value]={entries:[],archived:false};writeWeekStore(data)}
  localStorage.removeItem('mds_qs_draft');localStorage.removeItem('mds_log_dayFilter');
  localStorage.setItem(getWeekKey(),value);localStorage.setItem(getWeekKey()+'_mode','manual');
  resolveWeekEnding();updateWeekLabel();renderAll();return true;
 }
 function showWeeks(){
  const d=dialog('Saved weeks');
  d.append(element('p','Open a week to view, edit or export its entries.'));
  const data=readWeekStore();const keys=Array.from(new Set([week(),...Object.keys(data.weeks)])).sort().reverse();
  keys.forEach(key=>{
   const record=data.weeks[key];const count=record?.entries.length||0;
   const row=element('div',undefined,'workflow-week-row');
   row.append(element('span',weekLabel(key)+' · '+count+' '+(count===1?'entry':'entries')+(record?.archived?' · Archived':'')));
   row.append(button(key===week()?'Selected':'Open',()=>{if(selectWeek(key))d.close()}));d.append(row);
  });
  d.append(button('Close',()=>d.close()));
 }
 function archiveWeek(){
  if(workingDraft()){showToast('Save or reset your Quick Start entry before archiving');return}
  const current=week(),next=api.nextWeek(current),entries=getEntries();
  if(!entries.length){showToast('Add entries before archiving this week');return}
  const d=dialog('Save this week and start the next');
  d.append(element('p','Keep all '+entries.length+' entries for the week ending '+weekLabel(current)+'. Then open the week ending '+weekLabel(next)+'.'));
  d.append(button('Save week & continue',()=>{
   if(week()!==current||workingDraft()){d.close();showToast('The current week changed. Try again.');return}
   const data=readWeekStore();data.weeks[current]={...data.weeks[current],archived:true,archivedAt:new Date().toISOString()};writeWeekStore(data);
   const days=getDailyBreaks();const grossMins=days.reduce((s,x)=>s+x.totalMins,0),breakMins=days.reduce((s,x)=>s+x.breakMins,0);
   const histKey='ts_payhist'+empSuffix(),hist=JSON.parse(localStorage.getItem(histKey)||'[]').filter(x=>x.week!==current);
   hist.unshift({week:current,grossMins,breakMins,afterMins:Math.max(0,grossMins-breakMins)});localStorage.setItem(histKey,JSON.stringify(hist));
   selectWeek(next);d.close();showToast('Week saved. Previous weeks are available under Saved weeks.');
  }),button('Cancel',()=>d.close()));
 }
 function allJobs(){return Object.entries(readWeekStore().weeks).flatMap(([key,bucket])=>bucket.entries.map(entry=>({week:key,entry}))).filter(x=>x.entry.jobNumber||x.entry.vehicleReg||x.entry.driverName).sort((a,b)=>(b.entry.date||'').localeCompare(a.entry.date||'')||b.entry.id-a.entry.id)}
 function applyJob(entry){
  const apply=()=>{
   const d=draft();d.jobNumber=entry.jobNumber||'';d.vehicleReg=entry.vehicleReg||'';d.driverName=entry.driverName||'';d._blankVehicle=!d.vehicleReg;d._blankDriver=!d.driverName;d._savedAt=new Date().toISOString();
   localStorage.setItem('mds_qs_draft',JSON.stringify(d));renderAll();showToast('Job details copied. Record fresh times for this entry.');document.querySelector('.quickstart')?.scrollIntoView({block:'start',behavior:'smooth'});
  };
  const current=draft();
  if(current.jobNumber&&current.jobNumber!==entry.jobNumber){const d=dialog('Replace job details?');d.append(element('p','Your current entry has job '+current.jobNumber+'. Copy the selected job, vehicle and driver details? Your date and recorded times will stay in place.'));d.append(button('Copy details',()=>{d.close();apply()}),button('Cancel',()=>d.close()));}
  else apply();
 }
 function showJobs(){
  const d=dialog('Copy previous job details');const jobs=allJobs();
  d.append(element('p','Choose a job to reuse its number, vehicle and driver. Record fresh times for the new entry.'));
  if(!jobs.length)d.append(element('p','No previous job details yet.'));
  jobs.forEach(({entry})=>{const row=element('div',undefined,'workflow-week-row');row.append(element('span',formatDate(entry.date)+' · Job '+(entry.jobNumber||'—')+' · '+(entry.vehicleReg||'—')+' · '+(entry.driverName||'—')));row.append(button('Copy details',()=>{d.close();applyJob(entry)}));d.append(row)});
  d.append(button('Close',()=>d.close()));
 }
 function approveExport(kind){
  if(bypassExport){bypassExport=false;return true}
  const entries=getEntries();if(!entries.length)return true;
  const issues=api.checkEntries(entries,week());if(!issues.length)return true;
  const d=dialog('Check before exporting');d.append(element('p','Review these '+issues.length+' checks before sending your timesheet.'));
  issues.forEach(issue=>{const row=element('div',undefined,'workflow-check-row');row.append(element('span',issue.label+' — '+issue.message));row.append(button('Edit entry',()=>{d.close();openEdit(issue.id)}));d.append(row)});
  d.append(button('Export anyway',()=>{d.close();bypassExport=true;({pdf:generatePDF,csv:exportCSV,text:copyToClipboard})[kind]()}),button('Cancel',()=>d.close()));return false;
 }
 function undo(){
  const key=storageKey('timesheet_undo_v1'),saved=JSON.parse(localStorage.getItem(key)||'null');
  if(!saved||saved.expires<=Date.now()){showToast('Undo has expired');refreshUndo();return}
  writeWeekStore(api.restoreDeleted(readWeekStore(),saved.items));localStorage.removeItem(key);renderAll();showToast('Deleted entries restored');
 }
 function refreshUndo(){
  let bar=$('entry-undo-bar');if(!bar){bar=element('div',undefined,'entry-undo-bar');bar.id='entry-undo-bar';bar.setAttribute('role','status');const text=element('span');text.id='entry-undo-text';bar.append(text,button('Undo',undo));document.body.append(bar)}
  const saved=JSON.parse(localStorage.getItem(storageKey('timesheet_undo_v1'))||'null');
  if(saved&&saved.expires>Date.now()&&localStorage.getItem('ts_auth_user')){bar.hidden=false;$('entry-undo-text').textContent=saved.items.length+' '+(saved.items.length===1?'entry deleted':'entries deleted')+' · Undo available for '+Math.ceil((saved.expires-Date.now())/1000)+'s';}
  else {bar.hidden=true;if(saved&&saved.expires<=Date.now())localStorage.removeItem(storageKey('timesheet_undo_v1'))}
 }
 function refresh(){
  const quick=document.querySelector('.quickstart');
  if(quick&&!$('workflow-quick-actions')){
   const row=element('div',undefined,'workflow-actions');row.id='workflow-quick-actions';row.append(button('Copy previous job',showJobs));
   const label=element('label',undefined,'remember-details');const checkbox=element('input');checkbox.type='checkbox';checkbox.id='remember-usual-details';
   label.append(checkbox,document.createTextNode('Remember vehicle & driver'));row.append(label);quick.append(row);
   checkbox.addEventListener('change',()=>{
    const old=usualDetails();const driver=$('qsDriverSel').value==='__other__'?$('qsDriverOther').value.trim():$('qsDriverSel').value;
    localStorage.setItem(storageKey('timesheet_usual_v1'),JSON.stringify(checkbox.checked?{enabled:true,vehicleReg:$('qsReg').value.trim().toUpperCase(),driverName:driver}:{...old,enabled:false}));renderAll();
   });
  }
  if($('remember-usual-details'))$('remember-usual-details').checked=usualDetails().enabled!==false;
  const bar=document.querySelector('.week-ending-bar');
  if(bar&&!$('workflow-week-actions')){const row=element('div',undefined,'workflow-actions');row.id='workflow-week-actions';row.append(button('Saved weeks',showWeeks),button('Save week & start next',archiveWeek));bar.after(row)}
  const exportPage=$('page-export');
  if(exportPage&&!$('export-checks-panel')){const card=element('div',undefined,'card workflow-export-checks');card.id='export-checks-panel';card.append(element('h2','Timesheet checks'));const text=element('p');text.id='export-checks-summary';card.append(text,button('Review checks',()=>{if(!getEntries().length){showToast('No entries in this week yet');return}if(approveExport('pdf')){const d=dialog('Ready to export');d.append(element('p','No missing details or duplicate entries found.'),button('Close',()=>d.close()))}}));exportPage.prepend(card)}
  if($('export-checks-summary')){const count=api.checkEntries(getEntries(),week()).length;$('export-checks-summary').textContent=!getEntries().length?'No entries in this week yet.':count?count+' '+(count===1?'check needs':'checks need')+' your review before exporting.':'Ready to export — no missing details or duplicate entries found.';}
  refreshUndo();
 }
 window.MDSWorkflowUI={approveExport,refresh};
 const original=window.renderAll;window.renderAll=function(){original();refresh()};
 // Wait for the merged Log view, which is built on load.
 const observer=new MutationObserver(()=>{if(document.querySelector('.quickstart')&&!$('workflow-quick-actions'))refresh()});observer.observe($('mds-app'),{childList:true,subtree:true});
 window.addEventListener('load',refresh);refresh();setInterval(refreshUndo,1000);
})();

// Load optional watch synchronisation after the main timesheet is ready.
(function(){
 if(typeof document==='undefined')return;
 async function load(src){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)})}
 load('./watch-sync/core.js?v=1').then(()=>load('./watch-sync/phone.js?v=1')).catch(()=>console.warn('Watch connection could not be loaded'));
})();
