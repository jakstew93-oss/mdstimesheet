(function(){
 'use strict';
 const root=document.documentElement;
 const store=localStorage;
 window.mdsDayState=Object.create(null);
 function persist(){localStorage.setItem('mds_appearance_v1',JSON.stringify({theme:root.dataset.appTheme,layout:root.dataset.appLayout,view:root.dataset.appView}))}
 const themeNames={forest:'Forest',paper:'Paper',navy:'Midnight',sand:'Sand',arcade:'8-bit'};
 const header=document.querySelector('#mds-app>header');
 const themeButton=document.createElement('button');
 themeButton.type='button';themeButton.id='app-theme-button';themeButton.textContent='Theme';
 themeButton.setAttribute('aria-haspopup','dialog');
 header.insertBefore(themeButton,header.querySelector('.logout-btn'));
 const themeDialog=document.createElement('dialog');
 themeDialog.id='app-theme-dialog';themeDialog.setAttribute('aria-labelledby','theme-dialog-title');
 themeDialog.innerHTML='<div class="theme-dialog-head"><h2 id="theme-dialog-title">Appearance</h2><button type="button" id="close-theme">Close</button></div><div class="app-theme-options"></div><div class="appearance-layout-controls"><label for="app-layout-select">Layout</label><select id="app-layout-select"><option value="dashboard">Dashboard</option><option value="focus">Daily focus</option><option value="compact">Compact</option></select><label for="app-view-select">Screen layout</label><select id="app-view-select"><option value="auto">Automatic · Fold aware</option><option value="phone">Folded phone</option><option value="unfolded">Unfolded · Split view</option><option value="desktop">Desktop</option></select></div>';
 document.body.append(themeDialog);
 for(const setting of ['layout','view']){
  const input=document.getElementById('app-'+setting+'-select');
  const key='app'+setting[0].toUpperCase()+setting.slice(1);
  input.value=root.dataset[key];
  input.addEventListener('change',()=>{root.dataset[key]=input.value;persist();window.dispatchEvent(new Event('resize'))});
 }

 for(const [value,name] of Object.entries(themeNames)){
  const button=document.createElement('button');button.type='button';button.dataset.theme=value;
  button.append(document.createElement('span'),document.createTextNode(name));
  button.firstChild.className='theme-colour';button.firstChild.setAttribute('aria-hidden','true');
  button.addEventListener('click',()=>{root.dataset.appTheme=value;persist();syncThemePicker()});
  themeDialog.querySelector('.app-theme-options').append(button);
 }
 function syncThemePicker(){
  themeButton.setAttribute('aria-label','Change theme, current theme '+themeNames[root.dataset.appTheme]);
  themeDialog.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===root.dataset.appTheme)));
 }
 syncThemePicker();
 themeButton.addEventListener('click',()=>themeDialog.showModal());
 document.getElementById('close-theme').addEventListener('click',()=>themeDialog.close());
 themeDialog.addEventListener('click',e=>{if(e.target===themeDialog){const r=themeDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)themeDialog.close()}});
 document.addEventListener('toggle',e=>{if(e.target.matches?.('.mds-day'))window.mdsDayState[e.target.dataset.date]=e.target.open},true);
 const stages=[['startTime','Start work'],['timeOnSite','Arrived on site'],['timeOffSite','Leaving site'],['endTime','Finish work']];
 function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
 function readDraft(){try{return JSON.parse(store.getItem('mds_qs_draft')||'{}')||{}}catch{return {}}}
 function nextStage(){const draft=readDraft();return stages.findIndex(([key])=>!draft[key])}
 function updateNextStep(){
  const button=document.getElementById('next-time-step'),status=document.getElementById('next-step-status');
  if(!button)return;
  const draft=readDraft(),index=nextStage();
  const selectedWeek=localStorage.getItem(getWeekKey())||currentWeekEnding();
  const manual=index!==-1&&((draft.date&&draft.date!==todayISO())||!MDSTools.withinWeek(draft.date||todayISO(),selectedWeek));
  const label=index===-1?'Save entry':stages[index][1];
  if(button.textContent!==label)button.textContent=label;
  button.disabled=!!manual;
  const text=manual?'For another date, set the four times manually below.':index===-1?'All four times recorded. Review the details below, then save.':`${index} of 4 times recorded · Tap to record the current time.`;
  if(status.textContent!==text)status.textContent=text;
 }
 function addNextStep(){
  const quick=document.querySelector('.quickstart');
  if(!quick||document.getElementById('next-time-step'))return;
  const block=document.createElement('div');block.className='next-step-block';
  block.innerHTML='<button type="button" class="btn btn-primary" id="next-time-step">Start work</button><p id="next-step-status" role="status"></p><p id="next-step-error" role="alert"></p>';
  quick.querySelector('.qs-stages').before(block);
  document.getElementById('next-time-step').addEventListener('click',()=>{
   const index=nextStage(),draft=readDraft(),error=document.getElementById('next-step-error');error.textContent='';
   // Imported overnight timestamps have full dates; their clock times can cross midnight.
   const captured=draft._widget?.times;
   const originalCapture=Array.isArray(captured)&&captured.length>0&&captured.every((t,i)=>
    draft[stages[i]?.[0]]===new Date(t.epochMillis+t.offsetSeconds*1000).toISOString().slice(11,16));
   for(let step=1;step<stages.length;step++){
    const before=draft[stages[step-1][0]],after=draft[stages[step][0]];
    if(!originalCapture&&before&&after&&after<before){error.textContent='The recorded times are out of order. Adjust the times below before continuing.';return}
   }
   if(index===-1){document.getElementById('qsSaveBtn').click();updateNextStep();return}
   if(draft.date&&draft.date!==todayISO()){updateNextStep();return}
   const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
   const previous=index>0?draft[stages[index-1][0]]:null;
   if(previous&&time<previous){error.textContent='The current time is earlier than the previous step. Set this time manually below.';return}
   if(!draft.date){const date=document.getElementById('qsDate');date.value=todayISO();date.dispatchEvent(new Event('change',{bubbles:true}))}
   const input=quick.querySelector('.qs-stage-input[data-field="'+stages[index][0]+'"]');
   input.value=time;input.dispatchEvent(new Event('change',{bubbles:true}));updateNextStep();
  });
  updateNextStep();
 }
 // Only group existing nodes; their IDs, handlers and calculations stay intact.
 function arrange(){
  const log=document.querySelector('.mds-replacement');
  if(!log)return;
  addNextStep();updateNextStep();
  if(log.querySelector('.mds-overview'))return;
  const totals=log.querySelector('#logTotals'),entries=log.querySelector('#logEntriesHost');
  if(!totals||!entries)return;
  const overview=document.createElement('aside');overview.className='mds-overview';overview.setAttribute('aria-label','Weekly totals and entries');
  log.append(overview);overview.append(totals,entries);
 }
 arrange();
 new MutationObserver(arrange).observe(document.getElementById('mds-app'),{childList:true,subtree:true});
})();
