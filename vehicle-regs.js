// Vehicle reg dropdowns: the company vans plus any regs added on this phone, on every reg box in the app.
(function(root){
 'use strict';
 const FLEET=[['LA68 GEU','Martyn’s van'],['LD68 ULM','Jak’s van'],['SK69 PWV','Matt’s van'],['AY22 HTF','Ash’s van'],['BX22 VXR','Big van']];
 const KEY='mds_vehicle_regs_v1',INPUT_IDS=['qsReg','vehicleReg','editVehicleReg','vanReg'],NEW='__new';

 function normalise(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').replace(/\s+/g,' ').trim()}
 // Puts the space back in current-style plates typed without one (LD68ULM → LD68 ULM).
 function tidy(v){const r=normalise(v),compact=r.replace(/ /g,'');return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(compact)?compact.slice(0,4)+' '+compact.slice(4):r}
 const sameReg=(a,b)=>normalise(a).replace(/ /g,'')===normalise(b).replace(/ /g,'');
 function mergeList(saved){
  const out=FLEET.map(([reg,label])=>({reg,label,fleet:true}));
  for(const s of saved||[]){const reg=tidy(s&&s.reg);if(reg&&!out.some(o=>sameReg(o.reg,reg)))out.push({reg,label:String(s.label||'').trim(),fleet:false})}
  return out;
 }
 function addReg(saved,reg,label){
  reg=tidy(reg);if(!reg)return saved;
  if(mergeList(saved).some(o=>sameReg(o.reg,reg)))return saved;
  return [...(saved||[]),{reg,label:String(label||'').trim()}];
 }
 function removeReg(saved,reg){return (saved||[]).filter(s=>!sameReg(s.reg,reg))}

 const api={FLEET,tidy,sameReg,mergeList,addReg,removeReg};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSVehicleRegs=api;

 // ---------- Page ----------
 const valueProp=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
 function saved(){try{const l=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(l)?l:[]}catch(_){return []}}
 function save(list){try{localStorage.setItem(KEY,JSON.stringify(list))}catch(_){}}
 const optionText=o=>o.reg+(o.label?' · '+o.label:'');
 const pickers=new Set();

 function enhance(input){
  if(!input||input.dataset.regPicker)return;
  input.dataset.regPicker='1';
  const picker={input,adding:false};
  const select=document.createElement('select');select.className='reg-select';select.id=input.id+'Select';
  select.setAttribute('aria-label','Vehicle reg');
  const add=document.createElement('div');add.className='reg-add';add.hidden=true;
  add.innerHTML='<input type="text" class="reg-add-label" placeholder="Whose van? (optional)" aria-label="Whose van (optional)"><div class="reg-add-actions"><button type="button" class="btn btn-primary reg-add-save">Add to list</button><button type="button" class="btn btn-outline reg-add-cancel">Cancel</button></div>';
  const remove=document.createElement('button');remove.type='button';remove.className='reg-remove';remove.hidden=true;
  const owner=document.createElement('div');owner.className='reg-owner';
  Object.assign(picker,{select,add,remove,owner,label:add.querySelector('.reg-add-label')});
  input.before(select);input.after(add,owner,remove);
  // The closed box shows just the reg so it fits; the open list shows whose van each one is.
  const full=()=>{for(const o of select.options)if(o.dataset.full)o.textContent=o.dataset.full};
  select.addEventListener('pointerdown',full);select.addEventListener('focus',full);select.addEventListener('keydown',full);
  select.addEventListener('blur',()=>shorten(picker));
  input.classList.add('reg-typed');
  // Keep the dropdown in step when the app fills the box itself (drafts, editing an entry, clearing after save).
  Object.defineProperty(input,'value',{configurable:true,get(){return valueProp.get.call(this)},set(v){valueProp.set.call(this,v);if(!picker.adding)sync(picker)}});
  select.addEventListener('change',()=>{
   if(select.value===NEW){startAdding(picker);return}
   setValue(picker,select.value);shorten(picker);
  });
  add.querySelector('.reg-add-save').addEventListener('click',()=>finishAdding(picker));
  add.querySelector('.reg-add-cancel').addEventListener('click',()=>{stopAdding(picker);valueProp.set.call(input,picker.before||'');sync(picker)});
  input.addEventListener('keydown',e=>{if(picker.adding&&e.key==='Enter'){e.preventDefault();finishAdding(picker)}});
  remove.addEventListener('click',()=>{
   const reg=input.value;if(!confirm('Remove '+tidy(reg)+' from the reg list on this phone?'))return;
   save(removeReg(saved(),reg));refreshAll();
  });
  pickers.add(picker);
  stopAdding(picker);sync(picker);
 }
 function setValue(picker,reg){
  const input=picker.input;input.value=reg;
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function startAdding(picker){
  picker.adding=true;picker.before=picker.input.value;
  valueProp.set.call(picker.input,'');picker.label.value='';
  picker.input.hidden=false;picker.add.hidden=false;picker.remove.hidden=true;picker.owner.hidden=true;picker.input.placeholder='New reg, e.g. AB12 CDE';
  picker.input.focus();
 }
 function stopAdding(picker){picker.adding=false;picker.input.hidden=true;picker.add.hidden=true}
 function finishAdding(picker){
  const reg=tidy(picker.input.value);
  if(!reg){if(typeof showToast==='function')showToast('Type the new reg first');picker.input.focus();return}
  save(addReg(saved(),reg,picker.label.value));
  stopAdding(picker);refreshAll();setValue(picker,reg);
  if(typeof showToast==='function')showToast(reg+' added to the reg list');
 }
 function sync(picker){
  const {select,input,remove}=picker,current=input.value,list=mergeList(saved());
  const match=list.find(o=>sameReg(o.reg,current));
  let html='<option value="">— Select vehicle —</option>';
  for(const o of list)html+=`<option value="${o.reg}" data-full="${escape(optionText(o))}">${escape(optionText(o))}</option>`;
  if(current.trim()&&!match)html+=`<option value="${escape(current)}">${escape(current.toUpperCase())} (not in list)</option>`;
  html+=`<option value="${NEW}">+ Add a new reg…</option>`;
  if(select.dataset.html!==html){select.innerHTML=html;select.dataset.html=html}
  select.value=match?match.reg:current.trim()?current:'';
  const custom=match&&!match.fleet;remove.hidden=!custom||picker.adding;if(custom)remove.textContent='Remove '+match.reg+' from list';
  picker.owner.textContent=match&&match.label?match.label:'';picker.owner.hidden=!picker.owner.textContent||picker.adding;
  if(document.activeElement!==select)shorten(picker);
 }
 function shorten(picker){for(const o of picker.select.options)if(o.dataset.full)o.textContent=o.selected?o.value:o.dataset.full}
 function escape(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
 function refreshAll(){for(const p of pickers){if(!p.input.isConnected){pickers.delete(p);continue}if(!p.adding)sync(p)}}
 function scan(){for(const id of INPUT_IDS)enhance(document.getElementById(id))}

 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
 addEventListener('storage',e=>{if(e.key===KEY)refreshAll()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
})(typeof window==='undefined'?globalThis:window);
