// Sunday reminder and "sent to the office" log. Only in the MDS Timesheet Android app and only for the people
// listed below, the same as the shift dial.
// Sharing the timesheet PDF from the app records the week as sent, with the app it was shared to. The Android
// app is told which weeks are sent and reminds at 9am on Sunday if that Sunday's week isn't one of them.
// Android can't see whether Send was pressed in the email app, so a week can be un-marked by hand.
(function(root){
 'use strict';
 const ALLOWED_USERS=['Jak Stewart'];
 const HOUR=9,MINUTE=0;
 const PREF_KEY='mds_sunday_reminder';        // 'off' turns the reminder off; anything else (or missing) leaves it on
 const PENDING_KEY='mds_sent_pending_v1';
 const PUSHED_KEY='mds_reminder_pushed_v1';
 const KEEP_WEEKS=12,PENDING_FOR=15*60*1000;

 const isTimesheet=name=>/^Timesheet .+\.pdf$/i.test(name||'');
 function markSent(log,week,at,via){
  const next={...(log||{})};next[week]={at,via:via||''};
  Object.keys(next).sort().slice(0,-KEEP_WEEKS).forEach(k=>delete next[k]);
  return next;
 }
 function unmark(log,week){const next={...(log||{})};delete next[week];return next}
 // The share Android reported, if it is the one this page started.
 function matchShare(pending,last,now){
  if(!pending||!last||!pending.week||last.name!==pending.name)return null;
  if(!(last.at>=pending.at-2000)||now-pending.at>PENDING_FOR)return null;
  return {week:pending.week,at:last.at,via:last.app||''};
 }
 function reminderState(log,enabled){
  return {enabled:!!enabled,hour:HOUR,minute:MINUTE,sentWeeks:enabled?Object.keys(log||{}).sort():[]};
 }
 function sentLabel(entry){
  const d=new Date(entry.at);
  const when=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+', '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  return 'Sent '+when+(entry.via?' with '+entry.via:'');
 }

 const api={isTimesheet,markSent,unmark,matchShare,reminderState,sentLabel};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSSunday=api;
 const native=root.MDSNative;
 if(!native||!root.document)return;

 function read(key){try{return localStorage.getItem(key)}catch(_){return null}}
 function write(key,value){try{value==null?localStorage.removeItem(key):localStorage.setItem(key,value)}catch(_){}}
 function json(key,fallback){try{return JSON.parse(read(key)||'null')||fallback}catch(_){return fallback}}
 function user(){return read('ts_auth_user')||''}
 function eligible(){return ALLOWED_USERS.includes(user())}
 function reminderOn(){return eligible()&&read(PREF_KEY)!=='off'}
 const logKey=()=>'mds_sent_weeks_v1_'+user().toLowerCase().replace(/\s+/g,'_');
 const log=()=>json(logKey(),{});
 function selectedWeek(){try{return localStorage.getItem(getWeekKey())||currentWeekEnding()}catch(_){return ''}}
 const toast=m=>{if(typeof showToast==='function')showToast(m)};

 // ---------- Telling the app ----------
 function push(){
  if(!native.setReminder)return;
  const state=JSON.stringify(reminderState(eligible()?log():{},reminderOn()));
  if(read(PUSHED_KEY)===state)return;
  try{native.setReminder(state);write(PUSHED_KEY,state)}catch(_){}
 }

 // ---------- Logging the share ----------
 // native-bridge.js has already pointed navigator.share at Android's share menu; note the week as it goes out.
 const share=navigator.share;
 if(typeof share==='function')Object.defineProperty(navigator,'share',{configurable:true,value:function(data){
  const file=data&&data.files&&data.files[0];
  if(eligible()&&file&&isTimesheet(file.name)){
   const week=selectedWeek();
   if(week){
    // An app that can't report which app was picked still counts opening the share menu as sent.
    if(native.lastShare)write(PENDING_KEY,JSON.stringify({week,name:file.name,at:Date.now()}));
    else{write(logKey(),JSON.stringify(markSent(log(),week,Date.now(),'')));setTimeout(refresh,0)}
   }
  }
  return share.call(navigator,data);
 }});
 function collect(){
  if(!native.lastShare||!eligible())return;
  const pending=json(PENDING_KEY,null);if(!pending)return;
  let last;try{last=JSON.parse(native.lastShare()||'null')}catch(_){last=null}
  const sent=matchShare(pending,last,Date.now());
  if(sent){
   write(logKey(),JSON.stringify(markSent(log(),sent.week,sent.at,sent.via)));write(PENDING_KEY,null);
   toast('Timesheet logged as sent'+(sent.via?' with '+sent.via:''));
  }else if(Date.now()-pending.at>PENDING_FOR)write(PENDING_KEY,null);
 }

 // ---------- The card ----------
 function buildCard(page){
  const card=document.createElement('div');card.className='card';card.id='sunday-card';
  card.innerHTML='<h2>Sent to the office</h2>'
   +'<p class="su-status" style="font-size:15px;font-weight:600;margin-bottom:6px;"></p>'
   +'<p class="su-help" style="font-size:13px;color:var(--subtext);margin-bottom:14px;"></p>'
   +'<button type="button" class="btn btn-outline su-toggle"></button>'
   +'<div class="sd-pref su-remind"><span>Remind me on Sunday at 9am<small></small></span><button type="button" class="sd-switch" role="switch" aria-label="Sunday 9am reminder"></button></div>';
  card.querySelector('.su-toggle').addEventListener('click',()=>{
   const week=selectedWeek();if(!week)return;
   write(PENDING_KEY,null);                  // a choice made by hand wins over a share still being reported
   write(logKey(),JSON.stringify(log()[week]?unmark(log(),week):markSent(log(),week,Date.now(),'')));
   refresh();
  });
  card.querySelector('.sd-switch').addEventListener('click',()=>{write(PREF_KEY,reminderOn()?'off':'on');refresh()});
  const pdfCard=document.getElementById('pdfBtn')?.closest('.card');
  if(pdfCard)pdfCard.after(card);else page.append(card);
  return card;
 }
 let lastSig='';
 function render(){
  const page=document.getElementById('page-export');if(!page)return;
  let card=document.getElementById('sunday-card');
  if(!eligible()){if(card)card.hidden=true;lastSig='';return}
  const week=selectedWeek(),entry=log()[week]||null,on=reminderOn();
  const sig=JSON.stringify([week,entry,on]);
  if(card&&!card.hidden&&sig===lastSig)return;
  if(!card)card=buildCard(page);
  card.hidden=false;lastSig=sig;
  const weekLabel=week?new Date(week+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}):'';
  card.querySelector('.su-status').textContent=entry?'✓ '+sentLabel(entry):'Not sent yet';
  card.querySelector('.su-help').textContent=entry
   ?'Week ending '+weekLabel+'. If it didn’t actually go, mark it as not sent.'
   :'Week ending '+weekLabel+'. Sharing the timesheet PDF from this app logs it as sent.';
  card.querySelector('.su-toggle').textContent=entry?'Mark as not sent':'Mark as sent';
  card.querySelector('.su-remind small').textContent=native.setReminder?'Only if that week hasn’t been sent':'Update the app to get this reminder';
  card.querySelector('.sd-switch').setAttribute('aria-checked',String(on));
 }

 function refresh(){collect();push();render()}
 refresh();
 // Signing in or out and changing week don't reload the page, and the share menu reports back a moment after
 // the app is picked, so keep checking. Nothing is redrawn or sent unless something changed.
 setInterval(()=>{if(!document.hidden)refresh()},2000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 addEventListener('load',refresh);
})(typeof window==='undefined'?globalThis:window);
