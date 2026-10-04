(function(){
 'use strict';
 const names=['Jak Stewart','Cody Slack','Ash Kemp','Matthew Heath','Cameron Simpson','Martyn Evans','Antony Culver','Luke Chambers','Mark Smith','Jody Wilson'];
 const colours=['#60b7ff','#a8ef6a','#ff8a65','#c49aff','#5ee3d0','#ffe16b','#ff9dcc','#8da8ff','#f3b56c','#e8edf5'];
 const selectors={qsDriverSel:'qsDriverOther',driverNameSelect:'driverName',editDriverNameSelect:'editDriverName'};
 const controls=new WeakMap();let currentSelect=null,dialog=null,returnFocus=null;
 function avatar(name){
  const portraits={'Jak Stewart':'jak-stewart','Cody Slack':'cody-slack','Ash Kemp':'ash-kemp'};
  if(portraits[name]){
   const image=document.createElement('img');image.src='driver-avatars/'+portraits[name]+'.png';image.alt='';image.className='driver-avatar driver-avatar-portrait';image.setAttribute('aria-hidden','true');return image;
  }
  let index=names.indexOf(name);if(index<0)index=Array.from(name||'Driver').reduce((sum,c)=>sum+c.charCodeAt(0),0)%colours.length;
  const colour=colours[index],hat=colours[(index+3)%colours.length];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 16 20');svg.setAttribute('class','driver-avatar');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const accessory=index%3===0?'<path fill="#283045" d="M4 6H7V8H4ZM9 6H12V8H9ZM7 6H9V7H7Z"/>':index%3===1?'<path fill="#704938" d="M6 9H10V10H6Z"/>':'<path fill="#a95452" d="M7 9H9V10H7Z"/>';
  svg.innerHTML='<path fill="#11172b" d="M4 0H12V2H14V10H12V11H14V13H16V18H12V20H4V18H0V13H2V11H4V10H2V2H4Z"/><path fill="'+hat+'" d="M4 1H12V2H13V4H3V2H4ZM2 4H14V5H2Z"/><path fill="#f1c6a0" d="M4 5H12V9H10V11H6V9H4Z"/><path fill="#172238" d="M5 6H6V7H5ZM10 6H11V7H10Z"/>'+accessory+'<path fill="'+colour+'" d="M3 12H13V13H15V17H12V18H4V17H1V13H3Z"/><path fill="#fff1a7" d="M4 12H5V17H4ZM11 12H12V17H11ZM5 14H11V15H5Z"/><path fill="#f1c6a0" d="M1 16H3V18H1ZM13 16H15V18H13Z"/><path fill="#35435e" d="M4 18H7V20H3V19H4ZM9 18H12V19H13V20H9Z"/>';
  return svg;
 }
 function labelFor(select){const other=document.getElementById(selectors[select.id]);return select.value==='__other__'?(other?.value.trim()||'Other driver'):select.value||'Choose driver'}
 function paint(button,name){button.replaceChildren(avatar(name),document.createTextNode(name));}
 function openPicker(select,button){
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='driver-character-dialog';dialog.className='driver-character-dialog';dialog.setAttribute('aria-labelledby','driver-picker-title');
   dialog.innerHTML='<div class="driver-picker-head"><h2 id="driver-picker-title">Choose driver</h2><button type="button" class="driver-picker-close">Close</button></div><div class="driver-character-list"></div>';
   document.body.append(dialog);dialog.querySelector('.driver-picker-close').addEventListener('click',()=>dialog.close());
   dialog.addEventListener('close',()=>{returnFocus?.focus();currentSelect=null;returnFocus=null});
  }
  currentSelect=select;returnFocus=button;
  const list=dialog.querySelector('.driver-character-list');list.replaceChildren();
  for(const option of select.options){
   const row=document.createElement('button');row.type='button';row.className='driver-character-option';row.dataset.value=option.value;
   paint(row,option.value==='__other__'?'Other driver…':option.value||'No driver selected');
   row.setAttribute('aria-pressed',String(select.value===option.value));
   row.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();returnFocus=option.value==='__other__'?document.getElementById(selectors[select.id]):button;dialog.close()});
   list.append(row);
  }
  dialog.showModal();list.querySelector('[aria-pressed=true]')?.focus();
 }
 function sync(){
  for(const id of Object.keys(selectors)){
   const select=document.getElementById(id);if(!select)continue;
   let state=controls.get(select);
   if(!state){
    const button=document.createElement('button');button.type='button';button.className='driver-character-select';button.id=id+'-characters';button.setAttribute('aria-haspopup','dialog');
    select.before(button);select.hidden=true;state={button,name:null};controls.set(select,state);
    button.addEventListener('click',()=>openPicker(select,button));select.addEventListener('change',sync);
    document.getElementById(selectors[id])?.addEventListener('input',sync);
   }
   const name=labelFor(select);if(state.name!==name){state.name=name;paint(state.button,name);state.button.setAttribute('aria-label','Driver: '+name)}
  }
  document.querySelectorAll('.chip-drv').forEach(chip=>{if(!chip.querySelector('.driver-avatar'))chip.prepend(avatar(chip.textContent.trim()))});
 }
 sync();
 new MutationObserver(sync).observe(document.getElementById('mds-app'),{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
})();
