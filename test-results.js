// Test results notepad inside Pocket Tools: readings per job, checked as you type, saved on this phone for the signed-in person.
(function(root){
 'use strict';
 const T=root.MDSPocketTools,$=id=>document.getElementById(id);
 if(!T||!$('section-tools'))return;
 const FIELDS=[['cct','Cct','text','1'],['desc','Description','text','e.g. Sockets'],['cable','Cable','text','2.5/1.5'],['r1r2','R1+R2 (Ω)','text',''],['zs','Zs (Ω)','text',''],['irLL','IR L–N (MΩ)','text','>200'],['irLE','IR L–E (MΩ)','text','>200'],['rcd','RCD (ms)','text',''],['r1','Ring r1 (Ω)','text',''],['rn','Ring rn (Ω)','text',''],['r2','Ring r2 (Ω)','text','']];
 const key=()=>'mds_test_results_v1'+(typeof empSuffix==='function'?empSuffix():'');
 function load(){try{const d=JSON.parse(localStorage.getItem(key())||'null');return d&&Array.isArray(d.jobs)?d:{jobs:[]}}catch(_){return {jobs:[]}}}
 let data=load(),currentId=null,saveTimer=0,loadedKey=key();
 function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(loadedKey,JSON.stringify(data));status('Saved on this phone ✓')}catch(_){status('Couldn’t save: phone storage is full')}},300)}
 function status(text){const s=$('tr-status');if(s)s.textContent=text}
 const today=()=>new Date().toISOString().slice(0,10);
 const newCircuit=n=>({cct:String(n),desc:'',type:'B',rating:'32',cable:'2.5/1.5',r1r2:'',zs:'',irLL:'',irLE:'',rcd:'',r1:'',rn:'',r2:'',polarity:false});
 function newJob(){return {id:Date.now().toString(36),jobNumber:'',address:'',date:today(),earthing:'TN-C-S',ze:'',pfc:'',circuits:[newCircuit(1)]}}
 function job(){return data.jobs.find(j=>j.id===currentId)}
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
 function opts(list,sel){return list.map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(sel)?' selected':''}>${esc(l)}</option>`).join('')}
 function jobNumbers(){
  try{return [...new Set(Object.values(readWeekStore().weeks).flatMap(w=>w.entries).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>String(e.jobNumber||'').trim()).filter(Boolean))].slice(0,30)}catch(_){return []}
 }
 const label=j=>(j.jobNumber?'Job '+j.jobNumber:'No job number')+(j.address?' · '+j.address:'')+' · '+new Date(j.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});

 const card=document.createElement('details');card.className='card tool';card.id='tool-results';
 card.innerHTML='<summary><span class="tool-title">Test results notepad</span><span class="tool-blurb">Jot readings for each circuit by job; checked as you type.</span></summary><div class="tool-body" id="tr-body"></div>';
 $('section-tools').querySelector('.tools-head').after(card);
 card.addEventListener('toggle',()=>{if(card.open)render()});

 function render(){
  if(key()!==loadedKey){data=load();loadedKey=key();currentId=null}
  if(!job())currentId=data.jobs[0]?.id||null;
  const j=job(),body=$('tr-body');
  let html=`<div class="field"><label for="tr-job">Job</label><select id="tr-job">${opts(data.jobs.map(x=>[x.id,label(x)]),currentId)}<option value="__new"${j?'':' selected'}>+ New job</option></select></div>`;
  if(!j){body.innerHTML=html+'<p class="tool-hint">Start a new job to record test results.</p><button type="button" class="btn btn-primary" id="tr-start">Start a new job</button>';return}
  html+=`<datalist id="tr-jobnos">${jobNumbers().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
   <div class="field-row"><div class="field"><label for="tr-jobNumber">Job number</label><input id="tr-jobNumber" data-job="jobNumber" list="tr-jobnos" value="${esc(j.jobNumber)}" placeholder="e.g. 1234"></div><div class="field"><label for="tr-date">Date</label><input id="tr-date" type="date" data-job="date" value="${esc(j.date)}"></div></div>
   <div class="field"><label for="tr-address">Address / description</label><input id="tr-address" data-job="address" value="${esc(j.address)}" placeholder="e.g. 12 High Street, kitchen rewire"></div>
   <div class="field-row"><div class="field"><label for="tr-earthing">Earthing</label><select id="tr-earthing" data-job="earthing">${opts([['TN-C-S','TN-C-S (PME)'],['TN-S','TN-S'],['TT','TT']],j.earthing)}</select></div><div class="field"><label for="tr-ze">Ze (Ω)</label><input id="tr-ze" data-job="ze" inputmode="decimal" value="${esc(j.ze)}"></div></div>
   <div class="field"><label for="tr-pfc">PFC (kA)</label><input id="tr-pfc" data-job="pfc" inputmode="decimal" value="${esc(j.pfc)}"></div>`;
  j.circuits.forEach((c,i)=>{
   html+=`<fieldset class="tr-circuit" data-index="${i}"><legend>Circuit ${esc(c.cct||i+1)}</legend>
    <div class="tr-grid">${FIELDS.slice(0,3).map(([f,l,,ph])=>field(i,f,l,c[f],ph)).join('')}
    <div class="field"><label for="tr-${i}-type">Device</label><select id="tr-${i}-type" data-c="${i}" data-f="type">${opts([['B','Type B'],['C','Type C'],['D','Type D'],['','Fuse / other']],c.type)}</select></div>
    <div class="field"><label for="tr-${i}-rating">Rating</label><select id="tr-${i}-rating" data-c="${i}" data-f="rating">${opts(T.BREAKER_RATINGS.map(r=>[r,r+' A']),c.rating)}</select></div>
    ${FIELDS.slice(3).map(([f,l,,ph])=>field(i,f,l,c[f],ph)).join('')}</div>
    <label class="tr-check"><input type="checkbox" data-c="${i}" data-f="polarity"${c.polarity?' checked':''}> Polarity correct</label>
    <div class="tr-results" id="tr-${i}-checks" aria-live="polite"></div>
    <button type="button" class="btn btn-outline tr-remove" data-remove="${i}">Remove circuit</button></fieldset>`;
  });
  html+=`<div class="tr-actions"><button type="button" class="btn btn-secondary" id="tr-add">Add circuit</button><button type="button" class="btn btn-secondary" id="tr-copy">Copy as text</button><button type="button" class="btn btn-secondary" id="tr-share">Share</button><button type="button" class="btn btn-outline" id="tr-delete">Delete job</button></div><p class="tool-hint" id="tr-status">Saved on this phone.</p>`;
  body.innerHTML=html;
  j.circuits.forEach((_,i)=>checks(i));
 }
 function field(i,f,l,v,ph){return `<div class="field"><label for="tr-${i}-${f}">${esc(l)}</label><input id="tr-${i}-${f}" data-c="${i}" data-f="${f}" inputmode="${['desc','cable'].includes(f)?'text':'decimal'}" value="${esc(v)}" placeholder="${esc(ph)}"></div>`}
 function checks(i){
  const c=job().circuits[i],r=T.checkCircuit(c),box=$('tr-'+i+'-checks');if(!box)return;box.replaceChildren();
  const add=(text,state)=>{const s=document.createElement('span');s.className='tr-chip tool-'+state;s.textContent=text;box.append(s)};
  if(r.zs)add('Zs '+(r.zs.state==='ok'?'✓':r.zs.state==='warn'?'! over 80%':'✗')+' (max '+r.zs.max+' Ω, 80% '+r.zs.limit+')',r.zs.state);
  if(r.ir)add('IR '+(r.ir.state==='ok'?'✓ ≥ 1 MΩ':'✗ under 1 MΩ'),r.ir.state);
  if(r.rcd)add('RCD '+(r.rcd.state==='ok'?'✓ ≤ 300 ms':'✗ over 300 ms'),r.rcd.state);
  const r1=parseFloat(c.r1),rn=parseFloat(c.rn),r2=parseFloat(c.r2);
  if(r1>0&&rn>0&&r2>0){const ring=T.ringCheck(r1,rn,r2);add('Ring '+(ring.lineNeutralOk&&ring.ratioOk?'✓':'✗ check')+' (expect R1+R2 ≈ '+ring.r1r2+')',ring.lineNeutralOk&&ring.ratioOk?'ok':'bad')}
 }
 function asText(j){
  const lines=['Test results — '+(j.jobNumber?'Job '+j.jobNumber:'No job number'),[j.address,new Date(j.date+'T12:00:00').toLocaleDateString('en-GB'),j.earthing].filter(Boolean).join(' · ')];
  if(j.ze||j.pfc)lines.push(['Ze '+(j.ze||'–')+' Ω','PFC '+(j.pfc||'–')+' kA'].join(' · '));
  for(const c of j.circuits){
   const r=T.checkCircuit(c),mark=x=>x?(x.state==='ok'?' ✓':x.state==='warn'?' !':' ✗'):'';
   lines.push('','Cct '+(c.cct||'?')+' '+(c.desc||'')+' — '+(c.type?c.type+c.rating:'Fuse/other')+(c.cable?', '+c.cable:''));
   const parts=[];
   if(c.r1r2)parts.push('R1+R2 '+c.r1r2);
   if(c.zs)parts.push('Zs '+c.zs+(r.zs?' (max '+r.zs.max+')':'')+mark(r.zs));
   if(c.irLL||c.irLE)parts.push('IR L-N '+(c.irLL||'–')+' L-E '+(c.irLE||'–')+' MΩ'+mark(r.ir));
   if(c.rcd)parts.push('RCD '+c.rcd+' ms'+mark(r.rcd));
   if(c.r1||c.rn||c.r2)parts.push('Ring r1 '+(c.r1||'–')+' rn '+(c.rn||'–')+' r2 '+(c.r2||'–'));
   parts.push('Polarity '+(c.polarity?'✓':'not ticked'));
   lines.push('  '+parts.join(' · '));
  }
  return lines.join('\n');
 }
 const toast=m=>{if(typeof showToast==='function')showToast(m)};
 card.addEventListener('input',e=>{
  const t=e.target,j=job();if(!j)return;
  if(t.dataset.job){j[t.dataset.job]=t.value;save();if(t.dataset.job==='jobNumber'||t.dataset.job==='address'||t.dataset.job==='date'){const o=$('tr-job').querySelector(`option[value="${j.id}"]`);if(o)o.textContent=label(j)}}
  else if(t.dataset.c!=null){const c=j.circuits[Number(t.dataset.c)];c[t.dataset.f]=t.type==='checkbox'?t.checked:t.value;save();checks(Number(t.dataset.c));if(t.dataset.f==='cct')t.closest('fieldset').querySelector('legend').textContent='Circuit '+(t.value||Number(t.dataset.c)+1)}
 });
 card.addEventListener('change',e=>{
  if(e.target.id==='tr-job'){if(e.target.value==='__new'){const j=newJob();data.jobs.unshift(j);currentId=j.id;save()}else currentId=e.target.value;render();return}
 });
 card.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='tr-start'){const j=newJob();data.jobs.unshift(j);currentId=j.id;save();render();return}
  const j=job();if(!j)return;
  if(b.id==='tr-add'){j.circuits.push(newCircuit(j.circuits.length+1));save();render();$('tr-'+(j.circuits.length-1)+'-desc')?.focus();return}
  if(b.dataset.remove!=null){if(!confirm('Remove this circuit and its readings?'))return;j.circuits.splice(Number(b.dataset.remove),1);save();render();return}
  if(b.id==='tr-delete'){if(!confirm('Delete all test results for this job? This can’t be undone.'))return;data.jobs=data.jobs.filter(x=>x.id!==j.id);currentId=null;save();render();toast('Job deleted');return}
  if(b.id==='tr-copy'){try{await navigator.clipboard.writeText(asText(j));toast('Copied test results')}catch(_){toast('Copy not supported here')}return}
  if(b.id==='tr-share'){const text=asText(j);try{if(navigator.share)await navigator.share({title:'Test results',text});else{await navigator.clipboard.writeText(text);toast('Copied test results')}}catch(err){if(err&&err.name!=='AbortError')toast('Couldn’t share')}}
 });
 root.MDSTestResults={asText};
})(typeof window==='undefined'?globalThis:window);
