// Single source of truth for MDS drivers, login accounts and portraits.
// To add a new driver or user, add one row to ROSTER below.
(function(root){
 'use strict';
 const ROSTER=[
  {name:'Jak Stewart',     password:'js847', portrait:'jak-stewart-black-shirt'},
  {name:'Cody Slack',      password:'cs293', portrait:'cody-slack-black-shirt'},
  {name:'Ash Kemp',        password:'ak516', portrait:'ash-kemp-black-shirt'},
  {name:'Matthew Heath',   password:'mh738', portrait:'matthew-heath-black-shirt'},
  {name:'Cameron Simpson', password:'cs461'},
  {name:'Martyn Evans',    password:'me392', portrait:'martyn-evans'},
  {name:'Antony Culver',   password:'ac284'},
  {name:'Tobi Culver',     password:'tc398'},
  {name:'Oliver Spicer',   password:'os733', portrait:'oliver-spicer-black-shirt'},
  {name:'Michael Simpson', password:'ms191'},
  {name:'Luke Chambers',                     portrait:'luke-chambers-black-shirt'},
  {name:'Mark Smith'},
  {name:'Jody Wilson'},
 ];

 const names=ROSTER.map(d=>d.name);
 const passwords=Object.fromEntries(ROSTER.filter(d=>d.password).map(d=>[d.name,d.password]));
 const portraits=Object.fromEntries(ROSTER.filter(d=>d.portrait).map(d=>[d.name,d.portrait]));

 function fillSelect(select,list,opts){
  if(!select)return;
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

 const api={ROSTER,names,passwords,portraits,populateSelects};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDS_DRIVERS=api;
 if(root.document){
  const run=()=>populateSelects(root.document);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run);
  else run();
  root.addEventListener('load',run);
 }
})(typeof window==='undefined'?globalThis:window);
