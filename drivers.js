// Single source of truth for MDS drivers, login accounts and portraits.
// To add a new driver or user, add one row to ROSTER below (or use the Admin page as Jak Stewart).
(function(root){
 'use strict';
 const OVERRIDE_KEY='mds_drivers_override_v1';
 const BASE_ROSTER=[
  {name:'Jak Stewart',     password:'js847', portrait:'jak-stewart-black-shirt'},
  {name:'Cody Slack',      password:'cs293', portrait:'cody-slack-black-shirt'},
  {name:'Ash Kemp',        password:'ak516', portrait:'ash-kemp-black-shirt'},
  {name:'Matthew Heath',   password:'mh738', portrait:'matthew-heath-black-shirt'},
  {name:'Cameron Simpson', password:'cs461'},
  {name:'Martyn Evans',    password:'me392', portrait:'martyn-evans'},
  {name:'Antony Culver',   password:'ac284'},
  {name:'Tobi Culver',     password:'tc398', portrait:'tobi-culver'},
  {name:'Oliver Spicer',   password:'os733', portrait:'oliver-spicer-black-shirt'},
  {name:'Michael Simpson', password:'ms191'},
  {name:'Luke Chambers',                     portrait:'luke-chambers-black-shirt'},
  {name:'Mark Smith'},
  {name:'Jody Wilson'},
 ];

 function cleanRoster(list){
  if(!Array.isArray(list)||!list.length)return null;
  const seen=new Set(),out=[];
  for(const item of list){
   if(!item||typeof item.name!=='string')continue;
   const name=item.name.trim();
   if(!name||seen.has(name.toLowerCase()))continue;
   seen.add(name.toLowerCase());
   const row={name};
   if(typeof item.password==='string'&&item.password.trim())row.password=item.password.trim();
   if(typeof item.portrait==='string'&&item.portrait.trim())row.portrait=item.portrait.trim();
   out.push(row);
  }
  return out.length?out:null;
 }

 function loadInitial(){
  try{
   const saved=typeof localStorage!=='undefined'&&localStorage.getItem(OVERRIDE_KEY);
   if(saved){
    const parsed=cleanRoster(JSON.parse(saved));
    if(parsed)return parsed;
   }
  }catch(_){}
  return BASE_ROSTER.map(r=>({...r}));
 }

 const ROSTER=[];
 const names=[];
 const passwords={};
 const portraits={};

 function applyRoster(list){
  const cleaned=cleanRoster(list);
  if(!cleaned)return false;
  ROSTER.length=0;names.length=0;
  for(const k of Object.keys(passwords))delete passwords[k];
  for(const k of Object.keys(portraits))delete portraits[k];
  for(const r of cleaned){
   ROSTER.push(r);
   names.push(r.name);
   if(r.password)passwords[r.name]=r.password;
   if(r.portrait)portraits[r.name]=r.portrait;
  }
  if(root.document)populateSelects(root.document);
  return true;
 }

 function fillSelect(select,list,opts){
  if(!select)return;
  const sig=JSON.stringify([list,opts.placeholder||'',opts.otherLabel||'']);
  if(select.dataset&&select.dataset.mdsRoster===sig)return;
  const current=select.value;
  const placeholder=opts.placeholder||'— Select name —';
  const frag=select.ownerDocument.createDocumentFragment();
  const blank=select.ownerDocument.createElement('option');
  blank.value='';blank.textContent=placeholder;frag.append(blank);
  for(const name of list){
   const o=select.ownerDocument.createElement('option');
   o.value=name;o.textContent=name;frag.append(o);
  }
  if(opts.otherLabel){
   const other=select.ownerDocument.createElement('option');
   other.value='__other__';other.textContent=opts.otherLabel;frag.append(other);
  }
  select.replaceChildren(frag);
  if(select.dataset)select.dataset.mdsRoster=sig;
  if(current&&Array.from(select.options).some(o=>o.value===current))select.value=current;
 }

 function populateSelects(doc){
  const d=doc||(typeof document!=='undefined'?document:null);
  if(!d)return;
  fillSelect(d.getElementById('loginName'),ROSTER.filter(x=>x.password).map(x=>x.name),{placeholder:'— Select your name —'});
  fillSelect(d.getElementById('driverNameSelect'),names,{placeholder:'— Select name —',otherLabel:'Other (type below)...'});
  fillSelect(d.getElementById('editDriverNameSelect'),names,{placeholder:'— Select name —',otherLabel:'Other (type below)...'});
  fillSelect(d.getElementById('qsDriverSel'),names,{placeholder:'— Select name —',otherLabel:'Other…'});
 }

 applyRoster(loadInitial());

 const api={ROSTER,BASE_ROSTER,OVERRIDE_KEY,names,passwords,portraits,cleanRoster,applyRoster,populateSelects};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDS_DRIVERS=api;
 if(root.document){
  const run=()=>populateSelects(root.document);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run);
  else run();
  root.addEventListener('load',run);
 }
})(typeof window==='undefined'?globalThis:window);
