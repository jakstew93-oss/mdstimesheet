(function () {
 'use strict';
 let taps=0,lastTap=0,firstTap=0,dialog=null,returnFocus=null;
 function closeGame(){
  if(!dialog)return;
  dialog.close();dialog.remove();dialog=null;
  document.documentElement.style.overflow=previousOverflow;
  returnFocus?.focus();returnFocus=null;
 }
 let previousOverflow='';
 function openGame(button){
  if(dialog)return;
  returnFocus=button;previousOverflow=document.documentElement.style.overflow;
  dialog=document.createElement('dialog');dialog.id='spark-town-easter-egg';
  dialog.setAttribute('aria-label','Spark Town secret arcade');
  dialog.style.cssText='position:fixed;inset:0;width:100%;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#d7e7ba;color:#263a3d;overflow:hidden;';
  const shell=document.createElement('div');shell.style.cssText='height:100%;display:flex;flex-direction:column;';
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top));background:#263a3d;color:#f3f5df;font:22px VT323,monospace;';
  const title=document.createElement('span');title.textContent='⚡ Spark Town';
  const back=document.createElement('button');back.type='button';back.textContent='Back to timesheet';back.style.cssText='font:18px monospace;border:2px solid #b2cc9a;background:#edf1d3;color:#263a3d;padding:8px 10px;cursor:pointer;';back.onclick=closeGame;
  bar.append(title,back);
  const frame=document.createElement('iframe');frame.title='Spark Town electrician adventure';frame.src='spark-town.html?v=58';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;background:#d7e7ba;';
  shell.append(bar,frame);dialog.append(shell);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeGame()});
  document.documentElement.style.overflow='hidden';dialog.showModal();back.focus();
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('#ts-tabs button');
  if(!button||!button.getAttribute('onclick')?.includes("showPage('breaks'"))return;
  const now=performance.now();
  if(now-lastTap>1500||now-firstTap>6000){taps=0;firstTap=now;}
  lastTap=now;taps++;
  if(taps===6){taps=0;event.preventDefault();event.stopImmediatePropagation();openGame(button);}
 },true);
})();
