// Shift dial + glass look, for the Android app only.
// Turns on only when the page runs inside the MDS Timesheet app (window.MDSNative, or the app's user agent)
// AND the signed-in user is on the list below. In an ordinary browser, or for anyone else, it does nothing:
// <html> never gets data-shift-dial="on", so none of shift-dial.css applies and the Log page is unchanged.
// The dial only reads the Quick Start draft; recording and saving still go through the existing buttons.
(function(){
 'use strict';
 const ALLOWED_USERS=['Jak Stewart'];
 const PREF_KEY='mds_shift_dial';            // 'off' hides it; anything else (or missing) shows it
 const STAGES=['startTime','timeOnSite','timeOffSite','endTime'];
 const root=document.documentElement;

 function store(){try{return window.localStorage}catch(_){return null}}
 function read(key){try{return store()?.getItem(key)}catch(_){return null}}
 function inApp(){return !!window.MDSNative||/\bMDSTimesheetApp\//.test(navigator.userAgent||'')}
 function eligible(){return inApp()&&ALLOWED_USERS.includes(read('ts_auth_user')||'')}
 function enabled(){return eligible()&&read(PREF_KEY)!=='off'}

 function pad(n){return String(n).padStart(2,'0')}
 function todayISO(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
 function draft(){try{return JSON.parse(read('mds_qs_draft')||'{}')||{}}catch(_){return {}}}
 function mins(hm){if(!/^\d{2}:\d{2}$/.test(hm||''))return null;const [h,m]=hm.split(':').map(Number);return h*60+m}
 function span(a,b){let d=b-a;if(d<0)d+=1440;return d}            // past midnight counts forward
 function hrMin(total){const h=Math.floor(total/60),m=total%60;return h+'<small>hr</small> '+pad(m)+'<small>min</small>'}

 // 12-hour clock face, like a watch: 0 = top.
 const C=130,R=108;
 function point(minsOfDay){const a=((minsOfDay/60)%12)/12*Math.PI*2;return [C+R*Math.sin(a),C-R*Math.cos(a)]}
 function arc(from,length){
  if(from==null||length<=0)return '';
  length=Math.min(length,719);                                    // a full circle can't be drawn as one arc
  const [x1,y1]=point(from),[x2,y2]=point(from+length);
  return 'M '+x1.toFixed(1)+' '+y1.toFixed(1)+' A '+R+' '+R+' 0 '+(length>360?1:0)+' 1 '+x2.toFixed(1)+' '+y2.toFixed(1);
 }

 function model(){
  const d=draft(),now=new Date(),nowM=now.getHours()*60+now.getMinutes();
  const t=STAGES.map(k=>mins(d[k]));
  let done=0;while(done<4&&t[done]!=null)done++;
  const live=!d.date||d.date===todayISO();
  const upTo=i=>t[i+1]!=null?t[i+1]:(live&&done===i+1?nowM:null);
  const seg=i=>t[i]==null||upTo(i)==null?0:span(t[i],upTo(i));
  const arcs={travel:arc(t[0],seg(0)),site:arc(t[1],seg(1)),back:arc(t[2],seg(2))};
  let status,big,sub;
  if(done===0){status='Not started';big=pad(now.getHours())+':'+pad(now.getMinutes());sub='Tap Start work when you set off'}
  else if(done===4){status='Day done';big=hrMin(span(t[0],t[3]));sub=d.startTime+' – '+d.endTime}
  else if(!live){status='Another day';big=hrMin(span(t[0],t[done-1]));sub='Finish the times below'}
  else{
   const labels=['Travelling','On site','Heading back'];
   status=labels[done-1];big=hrMin(span(t[done-1],nowM));sub='Since '+d[STAGES[done-1]];
  }
  const nowDot=live&&done>0&&done<4?point(nowM):null;
  return {arcs,status,big,sub,nowDot};
 }

 function svg(m){
  return '<svg viewBox="0 0 260 260" aria-hidden="true">'
   +'<circle cx="130" cy="130" r="108" fill="none" stroke="color-mix(in srgb,var(--text) 9%,transparent)" stroke-width="26"/>'
   +(m.arcs.travel?'<path d="'+m.arcs.travel+'" fill="none" stroke="var(--accent-border,var(--accent))" stroke-width="26" stroke-linecap="round"/>':'')
   +(m.arcs.back?'<path d="'+m.arcs.back+'" fill="none" stroke="var(--accent-border,var(--accent))" stroke-width="26" stroke-linecap="round"/>':'')
   +(m.arcs.site?'<path d="'+m.arcs.site+'" fill="none" stroke="var(--accent)" stroke-width="26" stroke-linecap="round"/>':'')
   +(m.nowDot?'<circle cx="'+m.nowDot[0].toFixed(1)+'" cy="'+m.nowDot[1].toFixed(1)+'" r="7" fill="var(--text)"/>':'')
   +'</svg>';
 }

 let lastSig='';
 function render(){
  const quick=document.querySelector('.quickstart');
  if(!quick||root.dataset.shiftDial!=='on')return;
  let dial=quick.querySelector('.sd-dial');
  if(!dial){
   dial=document.createElement('div');dial.className='sd-dial';
   dial.innerHTML='<div class="sd-ring"><div class="sd-svg"></div><div class="sd-centre"><span class="sd-status"></span><span class="sd-big"></span><span class="sd-sub"></span></div></div>';
   const anchor=quick.querySelector('.next-step-block')||quick.querySelector('.qs-stages');
   if(anchor)anchor.before(dial);else quick.prepend(dial);
   lastSig='';
  }
  const m=model();
  const sig=JSON.stringify(m);
  if(sig===lastSig)return;lastSig=sig;
  dial.querySelector('.sd-svg').innerHTML=svg(m);
  dial.querySelector('.sd-status').textContent=m.status;
  dial.querySelector('.sd-big').innerHTML=m.big;           // only digits and our own <small> tags
  dial.querySelector('.sd-sub').textContent=m.sub;
  dial.querySelector('.sd-ring').setAttribute('role','img');
  dial.querySelector('.sd-ring').setAttribute('aria-label',m.status+'. '+m.sub);
 }

 function addPref(){
  const dialog=document.getElementById('app-theme-dialog');
  if(!dialog)return;
  let row=dialog.querySelector('.sd-pref');
  if(!row){
   row=document.createElement('div');row.className='sd-pref';
   row.innerHTML='<span>Shift dial &amp; glass<small>Only in this phone app</small></span><button type="button" class="sd-switch" role="switch" aria-label="Shift dial and glass look"></button>';
   dialog.append(row);
   row.querySelector('.sd-switch').addEventListener('click',()=>{
    try{store()?.setItem(PREF_KEY,enabled()?'off':'on')}catch(_){}
    apply();
   });
  }
  row.hidden=!eligible();
  row.querySelector('.sd-switch').setAttribute('aria-checked',String(enabled()));
 }

 function apply(){
  if(enabled())root.dataset.shiftDial='on';else delete root.dataset.shiftDial;
  addPref();render();
 }

 apply();
 // Sign-in and sign-out don't reload the page, and the watch can fill in times at any moment,
 // so check once a second. It only touches the page when something changed.
 setInterval(apply,1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply()});
 document.addEventListener('change',()=>setTimeout(apply,0),true);
 document.addEventListener('click',()=>setTimeout(apply,0),true);
})();
