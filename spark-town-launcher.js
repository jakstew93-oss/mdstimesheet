(function () {
 'use strict';
 let taps=0,lastTap=0,firstTap=0,dialog=null,returnFocus=null;
 const arcadeAllowed=()=>['arcade','pacman'].includes(document.documentElement.dataset.appTheme);
 new MutationObserver(()=>{taps=0;lastTap=0;firstTap=0;if(!arcadeAllowed())closeGame();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-app-theme']});
 function closeGame(){
  if(!dialog)return;
  dialog.close();dialog.remove();dialog=null;
  document.documentElement.style.overflow=previousOverflow;
  returnFocus?.focus();returnFocus=null;
 }
 let previousOverflow='';
 function openGame(button){
  if(dialog||!arcadeAllowed())return;
  returnFocus=button;previousOverflow=document.documentElement.style.overflow;
  dialog=document.createElement('dialog');dialog.id='spark-town-easter-egg';
  dialog.setAttribute('aria-label','Secret arcade game picker');
  dialog.style.cssText='position:fixed;inset:0;width:100%;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#d7e7ba;color:#263a3d;overflow:hidden;';
  const shell=document.createElement('div');shell.style.cssText='height:100%;display:flex;flex-direction:column;';
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top));background:#263a3d;color:#f3f5df;font:22px VT323,monospace;';
  const title=document.createElement('span');title.textContent='⚡ Arcade';
  const buttonStyle='font:16px monospace;border:2px solid #b2cc9a;background:#edf1d3;color:#263a3d;padding:8px 10px;cursor:pointer;';
  const back=document.createElement('button');back.type='button';back.textContent='Timesheet';back.setAttribute('aria-label','Back to timesheet');back.style.cssText=buttonStyle;back.onclick=closeGame;
  const games=document.createElement('button');games.type='button';games.textContent='Games';games.setAttribute('aria-label','Back to games');games.style.cssText=buttonStyle;games.hidden=true;
  const navigation=document.createElement('div');navigation.style.cssText='display:flex;gap:6px';navigation.append(games,back);bar.append(title,navigation);
  const frame=document.createElement('iframe');frame.style.cssText='width:100%;flex:1;min-height:0;border:0;background:#d7e7ba;';frame.hidden=true;
  const picker=document.createElement('div');picker.style.cssText='flex:1;overflow:auto;padding:24px 18px;background:#101a2e;color:#edf3dd;font:22px monospace;';
  const heading=document.createElement('h2');heading.textContent='Secret arcade unlocked';heading.style.cssText='font:30px monospace;margin:0 0 10px;color:#ffda68;';
  const intro=document.createElement('p');intro.textContent='Choose your game.';intro.style.cssText='font:18px monospace;margin:0 0 24px;';picker.append(heading,intro);
  for(const game of [{name:'Spark Town',description:'Explore with the crew. Clean the van, solve wiring puzzles and find Cody’s lunch.',path:'spark-town.html?v=62'},{name:'Cody’s Snackagotchi',description:'Feed passenger Cody. Throw burgers, fries and chicken into his mouth and watch him grow.',path:'cody-snackagotchi.html?v=62'},{name:'Cody’s Burger Chase',description:'Guide Cody round the maze eating chips. Grab a big burger and the chasing salads turn into burgers he can eat.',path:'cody-burger-chase.html?v=75'}]){
   const card=document.createElement('button');card.type='button';card.setAttribute('aria-label',game.name);card.style.cssText='display:block;width:100%;max-width:560px;margin:0 auto 18px;padding:20px;text-align:left;border:3px solid #8aa877;background:#eaf0d5;color:#263a3d;cursor:pointer;';
   const label=document.createElement('strong');label.textContent=game.name;label.style.cssText='display:block;font:26px monospace;margin-bottom:12px;';
   const description=document.createElement('span');description.textContent=game.description;description.style.cssText='font:18px monospace;line-height:1.5;display:block;';card.append(label,description);picker.append(card);
   card.onclick=()=>{picker.hidden=true;frame.hidden=false;frame.title=game.name;frame.src=game.path;games.hidden=false;games.focus();};
  }
  games.onclick=()=>{frame.hidden=true;frame.removeAttribute('src');picker.hidden=false;games.hidden=true;picker.querySelector('button').focus();};
  shell.append(bar,picker,frame);dialog.append(shell);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeGame()});
  document.documentElement.style.overflow='hidden';dialog.showModal();back.focus();
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('#ts-tabs button');
  if(!button||!button.getAttribute('onclick')?.includes("showPage('breaks'"))return;
  if(!arcadeAllowed()){taps=0;lastTap=0;firstTap=0;return;}
  const now=performance.now();
  if(now-lastTap>1500||now-firstTap>6000){taps=0;firstTap=now;}
  lastTap=now;taps++;
  if(taps===6){taps=0;event.preventDefault();event.stopImmediatePropagation();openGame(button);}
 },true);
})();
