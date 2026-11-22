// Live shift awareness strip in Quick Start: shows running shift duration, current break tier,
// and time remaining until the next break deduction threshold. Works for all drivers.
(function(root){
 'use strict';
 const BREAK_STEPS=[
  {hours:7,  mins:20},
  {hours:9,  mins:30},
  {hours:10, mins:45},
  {hours:13, mins:60},
  {hours:16, mins:75},
  {hours:18, mins:90},
  {hours:19, mins:105},
 ];

 const hm=t=>{const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(t||'');return m?Number(m[1])*60+Number(m[2]):null};
 const toHM=m=>{const x=((m%1440)+1440)%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')};
 const fmt=m=>{const h=Math.floor(m/60),r=m%60;return h?(r?h+'h '+String(r).padStart(2,'0')+'m':h+'h'):r+'m'};
 function span(startM,endM){let d=endM-startM;if(d<0)d+=1440;return d}

 function breakInfo(totalMins){
  let current=0,next=null;
  for(const step of BREAK_STEPS){
   if(totalMins>=step.hours*60)current=step.mins;
   else{next={atHours:step.hours,mins:step.mins,inMins:step.hours*60-totalMins};break}
  }
  return {current,after:Math.max(0,totalMins-current),next};
 }

 function whatIfFinish(start,finish,priorMins){
  const s=hm(start),f=hm(finish);
  if(s==null||f==null)return null;
  priorMins=Math.max(0,Number(priorMins)||0);
  const shiftMins=span(s,f);
  if(shiftMins<=0)return null;
  const combined=priorMins+shiftMins;
  const brk=breakInfo(combined);
  // Check if finishing 1 minute before any crossed break threshold would pay the same or more.
  let cliff=null;
  for(const step of BREAK_STEPS){
   const threshold=step.hours*60;
   if(combined>=threshold&&threshold-1>priorMins){
    const earlierCombined=threshold-1;
    const earlierBrk=breakInfo(earlierCombined);
    if(earlierBrk.after>=brk.after){
     const earlierShift=earlierCombined-priorMins;
     cliff={
      atHours:step.hours,
      earlierFinish:toHM(s+earlierShift),
      earlierPaid:earlierBrk.after,
      extraPaid:earlierBrk.after-brk.after,
      savedMins:combined-earlierCombined,
     };
    }
   }
  }
  return {shiftMins,combined,breakMins:brk.current,paidMins:brk.after,next:brk.next,cliff};
 }

 function summarize(draft,priorMins,nowDate,todayStr){
  draft=draft||{};priorMins=Math.max(0,Number(priorMins)||0);
  const start=hm(draft.startTime),end=hm(draft.endTime);
  if(start==null)return null;
  const date=/^\d{4}-\d{2}-\d{2}$/.test(draft.date||'')?draft.date:todayStr;
  const isToday=date===todayStr;

  if(end!=null){
   const shiftMins=span(start,end);
   if(shiftMins<=0)return null;
   const combined=priorMins+shiftMins;
   const brk=breakInfo(combined);
   return {
    mode:'done',
    shiftMins,combined,
    headline:'Shift: '+fmt(shiftMins)+(priorMins?' (day total '+fmt(combined)+')':''),
    detail:brk.current
     ?brk.current+'m break · '+fmt(brk.after)+' paid'
     :'No break deduction · '+fmt(brk.after)+' paid',
    warn:false,
   };
  }

  if(!isToday)return null;
  const nowM=nowDate.getHours()*60+nowDate.getMinutes();
  const elapsed=span(start,nowM);
  const combined=priorMins+elapsed;
  const brk=breakInfo(combined);
  const soon=!!(brk.next&&brk.next.inMins<=30);
  let detail;
  if(brk.current&&brk.next){
   detail=brk.current+'m break applies · '+brk.next.mins+'m break in '+fmt(brk.next.inMins)+' (at '+brk.next.atHours+'h)';
  }else if(brk.current){
   detail=brk.current+'m break applies · '+fmt(brk.after)+' paid so far';
  }else if(brk.next){
   detail='No break yet · '+brk.next.mins+'m break in '+fmt(brk.next.inMins)+' (at '+brk.next.atHours+'h)';
  }else{
   detail=fmt(brk.after)+' paid so far';
  }
  return {
   mode:'live',
   shiftMins:elapsed,combined,
   headline:'Live shift: '+fmt(elapsed)+(priorMins?' · day '+fmt(combined):''),
   detail,
   warn:soon,
  };
 }

 const api={BREAK_STEPS,breakInfo,summarize,whatIfFinish};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSShiftStatus=api;
 if(!root.document)return;

 const pad=n=>String(n).padStart(2,'0');
 const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
 function readDraft(){try{return JSON.parse(localStorage.getItem('mds_qs_draft')||'{}')||{}}catch(_){return {}}}
 function priorDayMins(date){
  if(typeof getEntries!=='function')return 0;
  try{
   return getEntries().filter(e=>e&&e.date===date&&e.startTime&&e.endTime).reduce((sum,e)=>{
    const a=hm(e.startTime),b=hm(e.endTime);
    return sum+(a!=null&&b!=null?span(a,b):0);
   },0);
  }catch(_){return 0}
 }

 let lastSig='',whatIfOpen=false,whatIfTime='';
 function whatIfEnabled(){
  let u='';try{u=localStorage.getItem('ts_auth_user')||''}catch(_){}
  if(!u)return false;
  const list=Array.isArray(root.MDS_CONFIG?.features?.whatIfBreak)?root.MDS_CONFIG.features.whatIfBreak:['Jak Stewart'];
  return list.includes(u);
 }
 function renderWhatIf(box,startTime,priorMins){
  const panel=box.querySelector('.ss-whatif');
  const toggle=box.querySelector('.ss-toggle');
  if(!panel||!toggle)return;
  const enabled=whatIfEnabled();
  toggle.hidden=!enabled;
  if(!enabled){panel.hidden=true;whatIfOpen=false;return}
  toggle.textContent=whatIfOpen?'What if ▴':'What if ▾';
  toggle.setAttribute('aria-expanded',String(whatIfOpen));
  panel.hidden=!whatIfOpen;
  if(!whatIfOpen)return;
  const inp=panel.querySelector('.ss-wi-input');
  if(!whatIfTime){
   const now=new Date();
   const rounded=Math.ceil((now.getHours()*60+now.getMinutes()+15)/15)*15;
   whatIfTime=toHM(rounded);
  }
  if(inp&&document.activeElement!==inp)inp.value=whatIfTime;
  const out=panel.querySelector('.ss-wi-out');
  const res=whatIfFinish(startTime,whatIfTime,priorMins);
  if(!res){out.textContent='Pick a finish time to check paid hours and break cliffs.';out.dataset.cliff='no';return}
  let text='Finish '+whatIfTime+' → '+fmt(res.combined)+' day · '+(res.breakMins?res.breakMins+'m break · ':'no break · ')+fmt(res.paidMins)+' paid';
  if(res.cliff){
   const gain=res.cliff.extraPaid?fmt(res.cliff.extraPaid)+' more paid':'same paid time';
   text+='\nBreak cliff: finishing by '+res.cliff.earlierFinish+' (under '+res.cliff.atHours+'h) gives '+fmt(res.cliff.earlierPaid)+' ('+gain+', '+res.cliff.savedMins+'m earlier).';
  }
  out.textContent=text;
  out.dataset.cliff=res.cliff?'yes':'no';
 }

 function render(){
  const quick=document.querySelector('.quickstart');
  if(!quick)return;
  let box=document.getElementById('mds-shift-status');
  if(!whatIfEnabled()){if(box)box.hidden=true;lastSig='';return}
  const today=todayISO(),d=readDraft();
  const date=/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')?d.date:today;
  const prior=priorDayMins(date);
  const info=summarize(d,prior,new Date(),today);
  if(!info){if(box)box.hidden=true;lastSig='';return}
  const sig=JSON.stringify([info.mode,info.headline,info.detail,info.warn,d.startTime||'',prior,whatIfEnabled(),whatIfOpen,whatIfTime]);
  if(box&&!box.hidden&&sig===lastSig)return;
  if(!box){
   box=document.createElement('div');box.id='mds-shift-status';box.className='shift-status-bar';box.setAttribute('role','status');
   box.innerHTML='<div class="ss-main"><span class="ss-dot" aria-hidden="true"></span><div class="ss-text"><strong class="ss-head"></strong><span class="ss-detail"></span></div><button type="button" class="ss-toggle" aria-expanded="false">What if ▾</button></div>'
    +'<div class="ss-whatif" hidden><div class="ss-wi-row"><label><span>Finish at</span><input type="time" class="ss-wi-input"></label>'
    +'<div class="ss-wi-nudges"><button type="button" data-nudge="-15">-15m</button><button type="button" data-nudge="15">+15m</button><button type="button" data-nudge="30">+30m</button></div></div>'
    +'<div class="ss-wi-out" aria-live="polite"></div></div>';
   box.querySelector('.ss-toggle').addEventListener('click',()=>{
    whatIfOpen=!whatIfOpen;
    if(whatIfOpen&&!whatIfTime){
     const cur=readDraft();
     if(hm(cur.endTime)!=null)whatIfTime=cur.endTime;
    }
    lastSig='';render();
   });
   box.querySelector('.ss-wi-input').addEventListener('input',e=>{
    if(hm(e.target.value)!=null){whatIfTime=e.target.value;lastSig='';render();}
   });
   box.querySelector('.ss-wi-nudges').addEventListener('click',e=>{
    const b=e.target.closest('button[data-nudge]');if(!b)return;
    const base=hm(whatIfTime);
    const now=new Date();
    const cur=base!=null?base:now.getHours()*60+now.getMinutes();
    whatIfTime=toHM(cur+Number(b.dataset.nudge));
    lastSig='';render();
   });
   const anchor=quick.querySelector('.next-step-block')||quick.querySelector('.qs-stages');
   if(anchor)anchor.after(box);else quick.prepend(box);
  }
  box.hidden=false;lastSig=sig;
  box.dataset.mode=info.mode;
  box.dataset.warn=info.warn?'yes':'no';
  box.querySelector('.ss-head').textContent=info.headline;
  box.querySelector('.ss-detail').textContent=info.detail;
  renderWhatIf(box,d.startTime,prior);
 }

 render();
 setInterval(()=>{if(!document.hidden)render()},15000);
 document.addEventListener('mds-entry-saved',()=>setTimeout(render,0));
 document.addEventListener('change',()=>setTimeout(render,0),true);
 document.addEventListener('click',()=>setTimeout(render,0),true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 root.addEventListener('load',render);
})(typeof window==='undefined'?globalThis:window);
