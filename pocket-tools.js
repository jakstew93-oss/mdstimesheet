// Pocket Tools: quick electrical calculators, added as a section in the top menu.
// Figures follow BS 7671:2018+A2 and the On-Site Guide. They are for quick checks, not a substitute for the regs.
(function(root){
 'use strict';
 const U0=230,CMIN=0.95;

 // Voltage drop, mV/A/m. Twin & earth: Table 4D5. SWA XLPE 90°C: Table 4E4B (2-core single-phase, 3/4-core three-phase).
 const VD_CABLES={
  te:{name:'Twin & earth (6242Y)',phase:1,mv:{'1.0':44,'1.5':29,'2.5':18,'4':11,'6':7.3,'10':4.4,'16':2.8}},
  swa2:{name:'SWA 2-core, single-phase',phase:1,mv:{'1.5':31,'2.5':19,'4':12,'6':7.9,'10':4.7,'16':2.9}},
  swa34:{name:'SWA 3/4-core, three-phase',phase:3,mv:{'1.5':27,'2.5':16,'4':10,'6':6.8,'10':4.0,'16':2.5}}
 };
 // Appendix 12: 3% lighting, 5% other uses, from a public supply.
 function voltDrop(mv,amps,metres,phase,lighting){
  const volts=mv*amps*metres/1000,nominal=phase===3?400:230,limitPct=lighting?3:5;
  return {volts,percent:volts/nominal*100,limitVolts:nominal*limitPct/100,limitPct,ok:volts<=nominal*limitPct/100};
 }

 // Max Zs for circuit-breakers and RCBOs (Table 41.3): 0.95 × 230 V ÷ instantaneous trip current (5, 10 or 20 × In).
 const TRIP_MULTIPLE={B:5,C:10,D:20};
 const BREAKER_RATINGS=[6,10,16,20,25,32,40,50,63,80,100,125];
 const round2=n=>Math.round(n*100)/100;
 function maxZs(type,rating){const k=TRIP_MULTIPLE[type];if(!k||!(rating>0))return null;return round2(CMIN*U0/(k*rating))}
 // Rule of thumb for comparing a measured Zs taken at room temperature.
 function measuredLimit(zs){return round2(zs*0.8)}
 // RCD providing fault protection (Table 41.5): 50 V ÷ rated residual current.
 function rcdMaxZs(milliamps){return Math.round(50/(milliamps/1000))}

 // Conductor resistance at 20°C, mΩ/m, line + cpc (On-Site Guide Table I1). ×1.20 for 70°C thermoplastic at operating temperature.
 const R1R2={'1.0/1.0':36.20,'1.5/1.0':30.20,'2.5/1.5':19.51,'4/1.5':16.71,'6/2.5':10.49,'10/4':6.44,'16/6':4.23};
 function expectedZs(ze,pair,metres){
  const r=R1R2[pair];if(r==null)return null;
  const r1r2=r*metres/1000;
  return {r1r2:round2(r1r2),r1r2Hot:round2(r1r2*1.2),zs:round2(ze+r1r2*1.2)};
 }
 // Ring final continuity (GN3): r1 and rn within 0.05 Ω; r2 about 1.67 × r1 for 2.5/1.5 cable; each socket should read about (r1 + r2) ÷ 4.
 function ringCheck(r1,rn,r2){
  return {lineNeutralOk:Math.abs(r1-rn)<=0.05,ratio:r1>0?round2(r2/r1):null,ratioOk:r1>0&&Math.abs(r2/r1-1.67)<=0.1,
   r1r2:round2((r1+r2)/4),r1rn:round2((r1+rn)/4)};
 }
 // Prospective fault current from a loop impedance, in kA.
 function faultCurrent(ohms){return ohms>0?round2(U0/ohms/1000):null}

 // Ohm's law: any two of V, I, R, P.
 function ohms(v){
  const known=['V','I','R','P'].filter(k=>v[k]>0);
  if(known.length!==2)return null;
  let {V,I,R,P}=v;const has=k=>known.includes(k);
  if(has('V')&&has('I')){R=V/I;P=V*I}
  else if(has('V')&&has('R')){I=V/R;P=V*V/R}
  else if(has('V')&&has('P')){I=P/V;R=V*V/P}
  else if(has('I')&&has('R')){V=I*R;P=I*I*R}
  else if(has('I')&&has('P')){V=P/I;R=P/(I*I)}
  else {V=Math.sqrt(P*R);I=Math.sqrt(P/R)}
  return {V,I,R,P};
 }
 function loadCurrent(kw,volts,pf,phase){
  if(!(kw>0&&volts>0&&pf>0&&pf<=1))return null;
  return kw*1000/((phase===3?Math.sqrt(3):1)*volts*pf);
 }

 // Cable sizing for twin & earth (Table 4D5 current ratings, Table 4B1 ambient, Table 4C1 grouping).
 const TE_SIZES=['1.0','1.5','2.5','4','6','10','16'];
 const TE_METHODS={
  C:{name:'Clipped direct (C)',amps:[16,20,27,37,47,64,85]},
  A:{name:'In conduit in an insulated wall (A)',amps:[11.5,14.5,20,26,32,44,57]},
  100:{name:'Above a plasterboard ceiling, insulation up to 100 mm (100)',amps:[13,16,21,27,34,45,57]},
  101:{name:'Above a plasterboard ceiling, insulation over 100 mm (101)',amps:[10.5,13,17,22,27,36,46]},
  102:{name:'In an insulated stud wall, touching the inner wall (102)',amps:[13,16,21,27,35,47,63]},
  103:{name:'In an insulated stud wall, not touching the inner wall (103)',amps:[8,10,13.5,17.5,23.5,32,42.5]}
 };
 const AMBIENT={25:1.03,30:1,35:0.94,40:0.87,45:0.79,50:0.71};
 const GROUPING=[1,0.8,0.7,0.65,0.6,0.57,0.54,0.52,0.5];
 function cableSize({ib,rating,method,ambient,circuits,metres,lighting}){
  const m=TE_METHODS[method],ca=AMBIENT[ambient],cg=GROUPING[Math.min(9,Math.max(1,circuits))-1];
  if(!m||!ca||!(ib>0)||!(rating>0))return null;
  const neededIt=rating/(ca*cg);
  const rows=TE_SIZES.map((size,i)=>{
   const it=m.amps[i],iz=round2(it*ca*cg),drop=metres>0?voltDrop(VD_CABLES.te.mv[size],ib,metres,1,lighting):null;
   const capacityOk=it>=neededIt,dropOk=!drop||drop.ok;
   return {size,it,iz,capacityOk,drop,dropOk,ok:capacityOk&&dropOk};
  });
  return {ratingOk:rating>=ib,neededIt:round2(neededIt),ca,cg,rows,suggestion:rating>=ib?(rows.find(r=>r.ok)||null):null};
 }

 const api={VD_CABLES,voltDrop,maxZs,measuredLimit,rcdMaxZs,BREAKER_RATINGS,R1R2,expectedZs,ringCheck,faultCurrent,ohms,loadCurrent,TE_SIZES,TE_METHODS,AMBIENT,GROUPING,cableSize};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSPocketTools=api;

 // ---------- Page ----------
 const $=id=>document.getElementById(id);
 const fmt=(n,dp=2)=>Number.isFinite(n)?Number(n.toFixed(dp)).toLocaleString('en-GB',{maximumFractionDigits:dp}):'–';
 const num=id=>{const v=parseFloat($(id).value);return Number.isFinite(v)?v:NaN};
 const opts=(list,selected)=>list.map(([value,label])=>`<option value="${value}"${String(value)===String(selected)?' selected':''}>${label}</option>`).join('');
 function field(id,label,input){return `<div class="field"><label for="${id}">${label}</label>${input}</div>`}
 function numberInput(id,placeholder,value=''){return `<input id="${id}" type="number" inputmode="decimal" step="any" min="0" placeholder="${placeholder}" value="${value}">`}
 function out(id){return `<div class="tool-out" id="${id}" aria-live="polite"></div>`}
 function show(id,lines){
  const box=$(id);box.replaceChildren();
  for(const [label,value,state] of lines){
   const row=document.createElement('div');row.className='tool-row'+(state?' tool-'+state:'');
   const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=value;row.append(a,b);box.append(row);
  }
 }
 function note(id,text){const box=$(id);const p=document.createElement('p');p.className='tool-hint';p.textContent=text;box.append(p)}
 const breakerOptions=BREAKER_RATINGS.map(r=>[r,r+' A']);
 const typeOptions=[['B','Type B MCB / RCBO'],['C','Type C MCB / RCBO'],['D','Type D MCB / RCBO']];

 const TOOLS=[
  {id:'vd',title:'Voltage drop',blurb:'Check a run against the 3% / 5% limits.',html:()=>
   field('vd-cable','Cable',`<select id="vd-cable">${opts(Object.entries(VD_CABLES).map(([k,c])=>[k,c.name]).concat([['custom','Other (enter mV/A/m)']]),'te')}</select>`)+
   `<div class="field-row">${field('vd-size','Size (mm²)','<select id="vd-size"></select>')}${field('vd-mv','mV/A/m',numberInput('vd-mv','e.g. 18'))}</div>`+
   `<div class="field-row">${field('vd-amps','Design current Ib (A)',numberInput('vd-amps','e.g. 20'))}${field('vd-length','Length (m)',numberInput('vd-length','e.g. 25'))}</div>`+
   field('vd-use','Circuit',`<select id="vd-use">${opts([['power','Power and other (5%)'],['lighting','Lighting (3%)']],'power')}</select>`)+out('vd-out'),
   calc(){
    const cable=VD_CABLES[$('vd-cable').value],sizeSel=$('vd-size');
    if(cable){const sizes=Object.keys(cable.mv);if(sizeSel.dataset.cable!==$('vd-cable').value){sizeSel.innerHTML=opts(sizes.map(s=>[s,s]),sizes.includes(sizeSel.value)?sizeSel.value:'2.5');sizeSel.dataset.cable=$('vd-cable').value}sizeSel.disabled=false;$('vd-mv').value=cable.mv[sizeSel.value];$('vd-mv').readOnly=true}
    else {sizeSel.innerHTML='<option>–</option>';sizeSel.dataset.cable='';sizeSel.disabled=true;$('vd-mv').readOnly=false}
    const mv=num('vd-mv'),amps=num('vd-amps'),len=num('vd-length');
    if(!(mv>0&&amps>0&&len>0)){show('vd-out',[]);note('vd-out','Enter the design current and the length of the run.');return}
    const phase=cable?cable.phase:1,r=voltDrop(mv,amps,len,phase,$('vd-use').value==='lighting');
    show('vd-out',[['Voltage drop',fmt(r.volts)+' V'],['Of '+(phase===3?'400':'230')+' V',fmt(r.percent)+' %'],['Limit',fmt(r.limitVolts)+' V ('+r.limitPct+'%)'],[r.ok?'Within the limit':'Over the limit',r.ok?'✓ OK':'✗ Too high',r.ok?'ok':'bad']]);
    if(!r.ok)note('vd-out','Try a bigger cable or a shorter run.');
   }},
  {id:'zs',title:'Max Zs',blurb:'Maximum earth fault loop impedance for a breaker.',html:()=>
   `<div class="field-row">${field('zs-type','Device',`<select id="zs-type">${opts(typeOptions,'B')}</select>`)}${field('zs-rating','Rating',`<select id="zs-rating">${opts(breakerOptions,32)}</select>`)}</div>`+
   field('zs-measured','Your measured Zs (Ω, optional)',numberInput('zs-measured','e.g. 0.62'))+out('zs-out'),
   calc(){
    const z=maxZs($('zs-type').value,Number($('zs-rating').value)),m=num('zs-measured'),lim=measuredLimit(z);
    const lines=[['Max Zs (Table 41.3)',fmt(z)+' Ω'],['80% for test readings',fmt(lim)+' Ω']];
    if(m>0)lines.push(['Your reading '+fmt(m)+' Ω',m<=lim?'✓ OK':m<=z?'! Check':'✗ Too high',m<=lim?'ok':m<=z?'warn':'bad']);
    show('zs-out',lines);
    if(m>lim&&m<=z)note('zs-out','Under the table value but over 80%: check it against the temperature correction in GN3.');
    note('zs-out','With an RCD giving fault protection (TT): 30 mA → '+rcdMaxZs(30)+' Ω, 100 mA → '+rcdMaxZs(100)+' Ω (50 V ÷ IΔn). Fuses aren’t included; use Table 41.2.');
   }},
  {id:'ez',title:'Expected Zs',blurb:'Estimate Zs from Ze, cable size and length.',html:()=>
   `<div class="field-row">${field('ez-ze','Ze (Ω)',numberInput('ez-ze','e.g. 0.35'))}${field('ez-length','Length (m)',numberInput('ez-length','e.g. 30'))}</div>`+
   field('ez-pair','Twin & earth (line / cpc mm²)',`<select id="ez-pair">${opts(Object.keys(R1R2).map(k=>[k,k]),'2.5/1.5')}</select>`)+
   `<div class="field-row">${field('ez-type','Device',`<select id="ez-type">${opts(typeOptions,'B')}</select>`)}${field('ez-rating','Rating',`<select id="ez-rating">${opts(breakerOptions,32)}</select>`)}</div>`+out('ez-out'),
   calc(){
    const ze=num('ez-ze'),len=num('ez-length');
    if(!(ze>=0&&len>0)){show('ez-out',[]);note('ez-out','Enter Ze and the cable length.');return}
    const r=expectedZs(ze,$('ez-pair').value,len),z=maxZs($('ez-type').value,Number($('ez-rating').value));
    show('ez-out',[['R1+R2 at 20°C',fmt(r.r1r2)+' Ω'],['R1+R2 at 70°C (×1.20)',fmt(r.r1r2Hot)+' Ω'],['Expected Zs',fmt(r.zs)+' Ω'],['Max Zs for '+$('ez-type').value+$('ez-rating').value,fmt(z)+' Ω'],[r.zs<=z?'Should pass':'Too long for this device',r.zs<=z?'✓ OK':'✗ Too high',r.zs<=z?'ok':'bad']]);
   }},
  {id:'ring',title:'Ring final check',blurb:'End-to-end readings for a 2.5/1.5 ring.',html:()=>
   `<div class="field-row">${field('ring-r1','r1 line (Ω)',numberInput('ring-r1','e.g. 0.52'))}${field('ring-rn','rn neutral (Ω)',numberInput('ring-rn','e.g. 0.53'))}</div>`+
   field('ring-r2','r2 cpc (Ω)',numberInput('ring-r2','e.g. 0.86'))+out('ring-out'),
   calc(){
    const r1=num('ring-r1'),rn=num('ring-rn'),r2=num('ring-r2');
    if(!(r1>0&&rn>0&&r2>0)){show('ring-out',[]);note('ring-out','Enter the three end-to-end readings.');return}
    const r=ringCheck(r1,rn,r2);
    show('ring-out',[['r1 vs rn (within 0.05 Ω)',r.lineNeutralOk?'✓ OK':'✗ Check',r.lineNeutralOk?'ok':'bad'],['r2 ÷ r1 (about 1.67)',fmt(r.ratio)+(r.ratioOk?' ✓':' ✗'),r.ratioOk?'ok':'bad'],['Expect R1+R2 at each socket','≈ '+fmt(r.r1r2)+' Ω'],['Expect R1+Rn at each socket','≈ '+fmt(r.r1rn)+' Ω']]);
    note('ring-out','After cross-connecting, readings at every socket should be about the same. A higher reading near the middle can mean a spur or a break.');
   }},
  {id:'pfc',title:'Fault current',blurb:'Prospective fault current from Ze or Zs.',html:()=>field('pfc-z','Loop impedance (Ω)',numberInput('pfc-z','e.g. 0.35'))+out('pfc-out'),
   calc(){
    const z=num('pfc-z');if(!(z>0)){show('pfc-out',[]);note('pfc-out','Enter Ze (at the origin) or Zs.');return}
    const ka=faultCurrent(z);show('pfc-out',[['Prospective fault current',fmt(ka)+' kA'],['Three-phase (rule of thumb ×2)','≈ '+fmt(ka*2)+' kA']]);
    note('pfc-out','Check your devices’ breaking capacity (e.g. 6 kA) is above this.');
   }},
  {id:'ohm',title:'Ohm’s law & power',blurb:'Fill in any two to get the rest.',html:()=>
   `<div class="field-row">${field('ohm-V','Volts (V)',numberInput('ohm-V','V'))}${field('ohm-I','Amps (A)',numberInput('ohm-I','A'))}</div>`+
   `<div class="field-row">${field('ohm-R','Ohms (Ω)',numberInput('ohm-R','Ω'))}${field('ohm-P','Watts (W)',numberInput('ohm-P','W'))}</div>`+out('ohm-out')+
   '<h3 class="tool-sub">Load current</h3>'+
   `<div class="field-row">${field('lc-kw','Load (kW)',numberInput('lc-kw','e.g. 9.5'))}${field('lc-pf','Power factor',numberInput('lc-pf','1','1'))}</div>`+
   field('lc-supply','Supply',`<select id="lc-supply">${opts([['1','Single-phase 230 V'],['3','Three-phase 400 V']],'1')}</select>`)+out('lc-out'),
   calc(){
    const v={V:num('ohm-V'),I:num('ohm-I'),R:num('ohm-R'),P:num('ohm-P')},r=ohms(v),filled=Object.values(v).filter(x=>x>0).length;
    if(r)show('ohm-out',[['Volts',fmt(r.V)+' V'],['Amps',fmt(r.I)+' A'],['Ohms',fmt(r.R,3)+' Ω'],['Watts',fmt(r.P,1)+' W']]);
    else {show('ohm-out',[]);note('ohm-out',filled>2?'Clear one box: fill in exactly two.':'Fill in any two boxes.')}
    const phase=Number($('lc-supply').value),amps=loadCurrent(num('lc-kw'),phase===3?400:230,num('lc-pf'),phase);
    if(amps)show('lc-out',[[phase===3?'Current per phase':'Current',fmt(amps,1)+' A']]);else{show('lc-out',[]);note('lc-out','Enter the load in kW (power factor 1 for heaters and showers).')}
   }},
  {id:'size',title:'Cable size helper',blurb:'Twin & earth size from the load, install method and length.',html:()=>
   `<div class="field-row">${field('cs-ib','Design current Ib (A)',numberInput('cs-ib','e.g. 28'))}${field('cs-rating','Breaker In',`<select id="cs-rating">${opts(breakerOptions.filter(([r])=>r<=63),32)}</select>`)}</div>`+
   field('cs-method','Installation method',`<select id="cs-method">${opts(Object.entries(TE_METHODS).map(([k,m])=>[k,m.name]),'C')}</select>`)+
   `<div class="field-row">${field('cs-ambient','Ambient temp',`<select id="cs-ambient">${opts(Object.keys(AMBIENT).map(t=>[t,t+' °C']),30)}</select>`)}${field('cs-group','Circuits grouped together',`<select id="cs-group">${opts(GROUPING.map((_,i)=>[i+1,String(i+1)]),1)}</select>`)}</div>`+
   `<div class="field-row">${field('cs-length','Length (m)',numberInput('cs-length','e.g. 20'))}${field('cs-use','Circuit',`<select id="cs-use">${opts([['power','Power (5%)'],['lighting','Lighting (3%)']],'power')}</select>`)}</div>`+out('cs-out'),
   calc(){
    const r=cableSize({ib:num('cs-ib'),rating:Number($('cs-rating').value),method:$('cs-method').value,ambient:Number($('cs-ambient').value),circuits:Number($('cs-group').value),metres:num('cs-length'),lighting:$('cs-use').value==='lighting'});
    if(!r){show('cs-out',[]);note('cs-out','Enter the design current.');return}
    if(!r.ratingOk){show('cs-out',[['Breaker rating','✗ Below Ib','bad']]);note('cs-out','The breaker must be at least the design current (Ib ≤ In).');return}
    const lines=[['Needed from the table (It)','≥ '+fmt(r.neededIt)+' A'],['Suggested size',r.suggestion?r.suggestion.size+' mm² T&E':'None up to 16 mm²',r.suggestion?'ok':'bad']];
    show('cs-out',lines);
    const t=document.createElement('table');t.className='tool-table';
    t.innerHTML='<thead><tr><th>mm²</th><th>Iz</th><th>Rating</th><th>Volt drop</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const row of r.rows){const tr=document.createElement('tr');if(row===r.suggestion)tr.className='tool-pick';
     for(const text of [row.size,fmt(row.iz,1)+' A',row.capacityOk?'✓':'✗',row.drop?(fmt(row.drop.percent,1)+'% '+(row.dropOk?'✓':'✗')):'–']){const td=document.createElement('td');td.textContent=text;tr.append(td)}
     body.append(tr)}
    t.append(body);$('cs-out').append(t);
    note('cs-out','Ca '+r.ca+' × Cg '+r.cg+'. Assumes a BS EN 60898/61009 breaker and no extra thermal insulation beyond the method chosen. Check Zs and the full regs before installing.');
   }}
 ];

 function build(){
  const panel=document.createElement('section');panel.id='section-tools';panel.hidden=true;
  panel.innerHTML='<div class="tools-head"><h2>Pocket Tools</h2><p>Quick checks to BS 7671 (18th Edition). Always confirm against the regs and the On-Site Guide.</p></div>'+
   TOOLS.map(t=>`<details class="card tool" id="tool-${t.id}"><summary><span class="tool-title">${t.title}</span><span class="tool-blurb">${t.blurb}</span></summary><div class="tool-body">${t.html()}</div></details>`).join('');
  return panel;
 }
 function signedIn(){try{return !!localStorage.getItem('ts_auth_user')}catch(_){return false}}
 function boot(){
  if(!$('sectionSelect')||typeof root.switchSection!=='function'||$('section-tools'))return;
  const option=document.createElement('option');option.value='tools';option.textContent='Pocket Tools';$('sectionSelect').append(option);
  const panel=build();($('section-expenses')||$('section-holiday')).after(panel);
  for(const t of TOOLS){const d=$('tool-'+t.id);const run=()=>{try{t.calc()}catch(e){console.warn('Pocket tool failed',e)}};d.addEventListener('input',run);d.addEventListener('change',run);run()}
  // Only one tool open at a time keeps the page short on a phone.
  panel.addEventListener('toggle',e=>{if(e.target.open)panel.querySelectorAll('details.tool[open]').forEach(d=>{if(d!==e.target)d.open=false})},true);
  const original=root.switchSection;
  root.switchSection=function(section){original(section);panel.hidden=section!=='tools';if(section==='tools')scrollTo(0,0)};
  const logout=root.doLogout;root.doLogout=function(){logout();if(!signedIn())panel.hidden=true};
  const login=root.doLogin;root.doLogin=function(){login();if(signedIn()&&$('sectionSelect').value==='tools')root.switchSection('tools')};
  let saved=null;try{saved=localStorage.getItem('ts_section')}catch(_){}
  if(saved==='tools'&&signedIn()){$('sectionSelect').value='tools';root.switchSection('tools')}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof window==='undefined'?globalThis:window);
