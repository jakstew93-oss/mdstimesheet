// Pay estimate on the Export page: the selected week's hours turned into gross pay, deductions and take-home.
// Only for the people listed below, on the website and in the MDS Timesheet Android app. Each of them keeps their own pay settings.
// The tax, National Insurance and pension figures follow the standard UK weekly rules for 2026/27. Real PAYE
// looks at the whole tax year so far, so this is an estimate, not a payslip.
(function(root){
 'use strict';
 const ALLOWED_USERS=['Jak Stewart','Martyn Evans','Oliver Spicer'];
 const SETTINGS_KEY='mds_pay_settings_v1';
 // Jak's settings from before stay where they were; everyone else gets their own, so people sharing a phone don't overwrite each other.
 function settingsKey(user){return user==='Jak Stewart'?SETTINGS_KEY:SETTINGS_KEY+':'+user}
 const DEFAULTS={rate:17,satX:1.5,sunX:1.5,night:20,nightTaxed:false,holidayHours:8,taxCode:'1257L',pensionPct:5,pensionBasis:'qualifying',pensionBeforeTax:true};

 // 2026/27, per week.
 const TAX={basicBand:37700/52,higherLimit:125140/52};
 const NI={from:242,to:967,main:0.08,upper:0.02};
 const PENSION={from:120,to:967};

 const pence=n=>Math.round((n+Number.EPSILON)*100)/100;
 const hm=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?Number(m[1])*60+Number(m[2]):null};
 // Minutes worked in an entry. A finish earlier than the start belongs to the next day.
 function entryMins(e){
  const a=hm(e.startTime),b=hm(e.endTime);
  if(a==null||b==null)return 0;
  const d=b-a;return d<0?d+1440:d;
 }

 // Weekly allowance for a tax code, or a flat rate for the codes that tax everything at one rate.
 function readCode(code){
  const c=String(code||'').toUpperCase().replace(/\s+/g,'').replace(/^[SC]/,'').replace(/(W1|M1|X)$/,'');
  if(c==='NT')return {flat:0};
  if(c==='BR')return {flat:0.2};
  if(c==='D0')return {flat:0.4};
  if(c==='D1')return {flat:0.45};
  let m=/^K(\d+)$/.exec(c);
  if(m)return {free:-(Number(m[1])*10)/52};
  m=/^(\d+)[LMNT]?$/.exec(c);
  if(m)return {free:Number(m[1])?(Number(m[1])*10+9)/52:0};
  return null;
 }
 function weeklyTax(pay,code){
  const c=readCode(code)||readCode(DEFAULTS.taxCode);
  if(c.flat!=null)return pence(Math.max(0,pay)*c.flat);
  const taxable=Math.max(0,Math.floor(pay-c.free));
  const basic=Math.min(taxable,TAX.basicBand);
  const higher=Math.min(Math.max(0,taxable-TAX.basicBand),TAX.higherLimit-TAX.basicBand);
  const top=Math.max(0,taxable-TAX.higherLimit);
  return pence(basic*0.2+higher*0.4+top*0.45);
 }
 function weeklyNI(pay){
  return pence(Math.max(0,Math.min(pay,NI.to)-NI.from)*NI.main+Math.max(0,pay-NI.to)*NI.upper);
 }
 function weeklyPension(pay,s){
  const on=s.pensionBasis==='all'?pay:Math.max(0,Math.min(pay,PENSION.to)-PENSION.from);
  return pence(on*(Number(s.pensionPct)||0)/100);
 }

 function clean(saved){
  const s={...DEFAULTS,...(saved||{})};
  ['rate','satX','sunX','night','holidayHours','pensionPct'].forEach(k=>{const n=Number(s[k]);s[k]=Number.isFinite(n)&&n>=0?n:DEFAULTS[k]});
  s.nightTaxed=!!s.nightTaxed;s.pensionBeforeTax=!!s.pensionBeforeTax;
  s.pensionBasis=s.pensionBasis==='all'?'all':'qualifying';
  s.taxCode=readCode(s.taxCode)?String(s.taxCode).toUpperCase().replace(/\s+/g,''):DEFAULTS.taxCode;
  return s;
 }

 // [breakFor] is the app's own break schedule: minutes worked in a day -> minutes deducted.
 // Breaks come off each day's combined hours, the same as on the timesheet.
 function estimate(entries,settings,breakFor){
  const s=clean(settings),days={};
  (entries||[]).forEach(e=>{
   if(!e||!/^\d{4}-\d{2}-\d{2}$/.test(e.date||''))return;
   const d=days[e.date]||(days[e.date]={mins:0,hol:false,food:false});
   d.mins+=entryMins(e);if(e.hol)d.hol=true;if(e.food)d.food=true;
  });
  let weekMins=0,satMins=0,sunMins=0,holidayDays=0,nights=0;
  Object.keys(days).forEach(date=>{
   const d=days[date],paid=Math.max(0,d.mins-(breakFor?breakFor(d.mins):0));
   const dow=new Date(date+'T12:00:00').getDay();
   if(dow===6)satMins+=paid;else if(dow===0)sunMins+=paid;else weekMins+=paid;
   if(d.hol&&!d.mins)holidayDays++;
   if(d.food)nights++;                       // one night away per day, however many jobs were ticked
  });
  const weekPay=pence(weekMins/60*s.rate),satPay=pence(satMins/60*s.rate*s.satX),sunPay=pence(sunMins/60*s.rate*s.sunX);
  const holidayPay=pence(holidayDays*s.holidayHours*s.rate),nightPay=pence(nights*s.night);
  const gross=pence(weekPay+satPay+sunPay+holidayPay+(s.nightTaxed?nightPay:0));
  const pension=weeklyPension(gross,s);
  const tax=weeklyTax(gross-(s.pensionBeforeTax?pension:0),s.taxCode);
  const ni=weeklyNI(gross);
  const untaxed=s.nightTaxed?0:nightPay;
  return {weekMins,satMins,sunMins,holidayDays,nights,weekPay,satPay,sunPay,holidayPay,nightPay,gross,tax,ni,pension,untaxed,
   total:pence(gross+untaxed),takeHome:pence(gross-tax-ni-pension+untaxed),settings:s};
 }

 const api={estimate,weeklyTax,weeklyNI,weeklyPension,readCode,clean,entryMins,settingsKey,ALLOWED_USERS,DEFAULTS};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSPay=api;
 if(!root.document)return;

 // ---------- The card ----------
 function read(key){try{return localStorage.getItem(key)}catch(_){return null}}
 const user=()=>read('ts_auth_user')||'';
 function eligible(){return ALLOWED_USERS.includes(user())}
 function settings(){try{return clean(JSON.parse(read(settingsKey(user()))||'{}'))}catch(_){return clean({})}}
 const money=n=>'£'+n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
 const hours=m=>Math.floor(m/60)+'h'+(m%60?' '+String(m%60).padStart(2,'0')+'m':'');

 function addStyles(){
  if(document.getElementById('pay-est-style'))return;
  const style=document.createElement('style');style.id='pay-est-style';
  style.textContent='#pay-est .pe-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:14px;border-bottom:1px solid var(--border)}'
   +'#pay-est .pe-row span:first-child{color:var(--subtext)}#pay-est .pe-row.pe-sum{font-weight:700}#pay-est .pe-row.pe-sum span:first-child{color:var(--text)}'
   +'#pay-est .pe-take{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 0 4px;font-weight:800;font-size:22px;color:var(--accent)}'
   +'#pay-est .pe-take span:first-child{font-size:14px}#pay-est .pe-note{font-size:12px;color:var(--subtext);margin:6px 0 12px}'
   +'#pay-est details summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--accent);padding:6px 0}'
   +'#pay-est .pe-field{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0;font-size:13px}'
   +'#pay-est .pe-field input,#pay-est .pe-field select{width:130px;flex:none;margin:0}';
  document.head.append(style);
 }

 const FIELDS=[
  ['rate','Hourly rate (£)','number'],['satX','Saturday rate (×)','number'],['sunX','Sunday rate (×)','number'],
  ['night','Night away (£)','number'],['nightTaxed','Night away is taxed','yesno'],['holidayHours','Paid hours for a holiday day','number'],
  ['taxCode','Tax code','text'],['pensionPct','Pension (%)','number'],
  ['pensionBasis','Pension is worked out on','choice',[['qualifying','Pay over £120'],['all','All pay']]],
  ['pensionBeforeTax','Pension comes off before tax','yesno'],
 ];
 function buildCard(page){
  addStyles();
  const card=document.createElement('div');card.className='card';card.id='pay-est';
  card.innerHTML='<h2>Pay estimate</h2><div class="pe-rows"></div><p class="pe-note"></p><details><summary>Pay settings</summary><div class="pe-fields"></div></details>';
  const fields=card.querySelector('.pe-fields');
  FIELDS.forEach(([key,label,type,options])=>{
   const row=document.createElement('label');row.className='pe-field';
   const text=document.createElement('span');text.textContent=label;
   let input;
   if(type==='yesno'||type==='choice'){
    input=document.createElement('select');
    (options||[['yes','Yes'],['no','No']]).forEach(([value,name])=>{const o=document.createElement('option');o.value=value;o.textContent=name;input.append(o)});
   }else{
    input=document.createElement('input');input.type=type;
    if(type==='number'){input.inputMode='decimal';input.step='any';input.min='0'}
   }
   input.dataset.key=key;input.dataset.kind=type;
   row.append(text,input);fields.append(row);
  });
  fields.addEventListener('change',e=>{
   const input=e.target;if(!input.dataset||!input.dataset.key)return;
   const next={...settings()};
   next[input.dataset.key]=input.dataset.kind==='yesno'?input.value==='yes':input.dataset.kind==='number'?Number(input.value):input.value;
   try{localStorage.setItem(settingsKey(user()),JSON.stringify(clean(next)))}catch(_){}
   lastSig='';render();
  });
  (page.querySelector('.summary-card')||page.firstElementChild).after(card);
  return card;
 }
 function fillFields(card,s){
  card.querySelectorAll('[data-key]').forEach(input=>{
   if(input===document.activeElement)return;
   const v=s[input.dataset.key];
   input.value=input.dataset.kind==='yesno'?(v?'yes':'no'):String(v);
  });
 }

 let lastSig='';
 function render(){
  const page=document.getElementById('page-export');if(!page)return;
  let card=document.getElementById('pay-est');
  if(!eligible()||typeof getEntries!=='function'||typeof getBreakMins!=='function'||typeof minsToStr!=='function'){if(card)card.hidden=true;lastSig='';return}
  let entries;try{entries=getEntries()}catch(_){return}
  const s=settings(),sig=JSON.stringify([user(),entries,s]);
  if(card&&!card.hidden&&sig===lastSig)return;
  if(!card)card=buildCard(page);
  card.hidden=false;lastSig=sig;
  const e=estimate(entries,s,m=>getBreakMins(minsToStr(m)));
  const rows=[];
  if(e.weekMins)rows.push(['Mon–Fri · '+hours(e.weekMins)+' × '+money(s.rate),money(e.weekPay)]);
  if(e.satMins)rows.push(['Saturday · '+hours(e.satMins)+' × '+money(s.rate*s.satX),money(e.satPay)]);
  if(e.sunMins)rows.push(['Sunday · '+hours(e.sunMins)+' × '+money(s.rate*s.sunX),money(e.sunPay)]);
  if(e.holidayDays)rows.push(['Holiday · '+e.holidayDays+' day'+(e.holidayDays>1?'s':'')+' × '+s.holidayHours+'h',money(e.holidayPay)]);
  if(e.nights)rows.push(['Nights away · '+e.nights+' × '+money(s.night),money(e.nightPay)]);
  rows.push(['Total before deductions',money(e.total),'pe-sum']);
  rows.push(['Income tax','−'+money(e.tax)],['National Insurance','−'+money(e.ni)],['Pension','−'+money(e.pension)]);
  const box=card.querySelector('.pe-rows');box.textContent='';
  rows.forEach(([label,value,cls])=>{
   const row=document.createElement('div');row.className='pe-row'+(cls?' '+cls:'');
   const a=document.createElement('span');a.textContent=label;const b=document.createElement('span');b.textContent=value;
   row.append(a,b);box.append(row);
  });
  const take=document.createElement('div');take.className='pe-take';
  const a=document.createElement('span');a.textContent='Take-home, about';const b=document.createElement('span');b.textContent=money(e.takeHome);
  take.append(a,b);box.append(take);
  card.querySelector('.pe-note').textContent='An estimate for the selected week, using hours after breaks. Only you see this. Each food allowance tick counts as one night away.';
  fillFields(card,s);
 }

 render();
 // Signing in or out and changing week don't reload the page, so keep checking. Nothing is redrawn unless something changed.
 setInterval(render,1500);
 document.addEventListener('mds-entry-saved',()=>setTimeout(render,0));
 document.addEventListener('click',()=>setTimeout(render,0),true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
})(typeof window==='undefined'?globalThis:window);
