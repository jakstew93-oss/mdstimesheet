// Cody's Burger Chase: a Pac-Man style maze. Cody eats chips; big burgers turn the salads into burgers he can eat.
(function(root){
 'use strict';
 // # wall, - ghost house door, . chip, o big burger, P Cody, G salad in the house, space empty path.
 const MAZE=[
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '####.#       #.####',
  '####.# ##-## #.####',
  '    .  #GGG#  .    ',
  '####.# ##### #.####',
  '####.#       #.####',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################'
 ];
 const DIRS={up:[0,-1],left:[-1,0],down:[0,1],right:[1,0]};
 const OPP={up:'down',down:'up',left:'right',right:'left'};
 const key=(x,y)=>x+','+y;

 function parseMaze(rows){
  const h=rows.length,w=rows[0].length,walls=[],chips=new Set(),burgers=new Set(),house=[];let player=null,door=null;
  rows.forEach((row,y)=>{
   if(row.length!==w)throw new Error('Maze row '+y+' is '+row.length+' wide, expected '+w);
   [...row].forEach((c,x)=>{
    walls.push(c==='#'||c==='-');
    if(c==='.')chips.add(key(x,y));
    if(c==='o')burgers.add(key(x,y));
    if(c==='P')player={x,y};
    if(c==='G')house.push({x,y});
    if(c==='-')door={x,y};
   });
  });
  return {w,h,walls,chips,burgers,player,house,door,exit:{x:door.x,y:door.y-1}};
 }
 function wrapX(m,x){return ((x%m.w)+m.w)%m.w}
 function isWall(m,x,y){return y<0||y>=m.h||m.walls[y*m.w+wrapX(m,x)]}
 function openDirs(m,x,y){return Object.keys(DIRS).filter(d=>!isWall(m,x+DIRS[d][0],y+DIRS[d][1]))}
 function reachable(m,start){
  const seen=new Set([key(start.x,start.y)]),queue=[start];
  while(queue.length){const {x,y}=queue.shift();for(const d of openDirs(m,x,y)){const nx=wrapX(m,x+DIRS[d][0]),ny=y+DIRS[d][1],k=key(nx,ny);if(!seen.has(k)){seen.add(k);queue.push({x:nx,y:ny})}}}
  return seen;
 }
 // Salads never turn back unless stuck; they take the turn closest to their target, or a random one when they are burgers.
 function chooseDir(m,x,y,dir,target,random){
  let options=openDirs(m,x,y).filter(d=>d!==OPP[dir]);
  if(!options.length)options=[OPP[dir]];
  if(random)return options[Math.floor(random()*options.length)];
  let best=options[0],bestDistance=Infinity;
  for(const d of options){const nx=x+DIRS[d][0],ny=y+DIRS[d][1],distance=(nx-target.x)**2+(ny-target.y)**2;if(distance<bestDistance){bestDistance=distance;best=d}}
  return best;
 }
 function ahead(p,dir,n){return {x:p.x+DIRS[dir][0]*n,y:p.y+DIRS[dir][1]*n}}
 // Tomato chases Cody, Lettuce heads him off, Cucumber flanks with Tomato and Carrot loses interest up close.
 function chaseTarget(index,cody,salads){
  if(index===0)return {x:cody.x,y:cody.y};
  if(index===1)return ahead(cody,cody.dir,4);
  if(index===2){const pivot=ahead(cody,cody.dir,2),t=salads[0];return {x:pivot.x*2-t.x,y:pivot.y*2-t.y}}
  const s=salads[3];return (s.x-cody.x)**2+(s.y-cody.y)**2>64?{x:cody.x,y:cody.y}:CORNERS[3];
 }
 const CORNERS=[{x:17,y:-2},{x:1,y:-2},{x:18,y:21},{x:0,y:21}];
 const MODES=[['scatter',7],['chase',20],['scatter',7],['chase',20],['scatter',5],['chase',Infinity]];
 function modeAt(seconds){let t=seconds;for(const [mode,length] of MODES){if(t<length)return mode;t-=length}return 'chase'}
 function levelSettings(level){
  const n=Math.max(0,level-1);
  return {codySpeed:5.2*Math.min(1.25,1+0.05*n),saladSpeed:4.7*Math.min(1.3,1+0.06*n),burgerSpeed:2.8,powerTime:Math.max(3,8.5-0.6*n)};
 }
 const BURGER_POINTS=[200,400,800,1600];

 const api={MAZE,DIRS,OPP,parseMaze,isWall,openDirs,reachable,chooseDir,chaseTarget,modeAt,levelSettings,BURGER_POINTS,CORNERS};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}

 // ---------- Game ----------
 const $=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d');
 const T=16,maze=parseMaze(MAZE),W=maze.w*T,H=maze.h*T;
 const SALADS=[{name:'Tomato',body:'#e8483c',dark:'#a8261f'},{name:'Lettuce',body:'#7fd34e',dark:'#3f8f2a'},{name:'Cucumber',body:'#2fae7a',dark:'#17694a'},{name:'Carrot',body:'#ff9a3c',dark:'#c45f12'}];
 let state='title',level=1,score=0,lives=3,best=0,extraLifeGiven=false,chips,burgers,cody,salads,modeClock=0,powerLeft=0,burgerStreak=0,pauseTimer=0,afterPause=null,message='',deathTime=0,flash=0,last=0,sound=false,audio=null,chomp=0,lastChip=0,bite=0,bonus=[];
 try{best=Number(localStorage.getItem('cody_burger_chase_best_v1'))||0}catch(_){}

 const dpr=Math.min(3,window.devicePixelRatio||1);
 canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;

 // Cody's head from his crew portrait, cut along his smile so the lower jaw can drop open and chomp.
 // Shapes are in the portrait's own pixels (1254 square); the head is cropped to a 1000px square from (127,55).
 const HEAD=192,CROP={x:127,y:55,size:1000};
 const headTop=document.createElement('canvas'),headJaw=document.createElement('canvas');headTop.width=headTop.height=headJaw.width=headJaw.height=HEAD;
 function headOutline(g){g.beginPath();g.ellipse(627,575,395,520,0,0,Math.PI*2)}
 function jawOutline(g){
  g.beginPath();g.moveTo(250,1150);g.lineTo(420,935);g.lineTo(488,822);
  g.quadraticCurveTo(620,838,754,815);g.lineTo(835,935);g.lineTo(1010,1150);g.closePath();
 }
 function portraitSpace(g){g.setTransform(HEAD/CROP.size,0,0,HEAD/CROP.size,-CROP.x*HEAD/CROP.size,-CROP.y*HEAD/CROP.size);g.imageSmoothingQuality='high'}
 const portrait=new Image();portrait.onload=()=>{
  const top=headTop.getContext('2d');portraitSpace(top);headOutline(top);top.clip();top.drawImage(portrait,0,0);
  top.globalCompositeOperation='destination-out';jawOutline(top);top.fill();
  const jaw=headJaw.getContext('2d');portraitSpace(jaw);headOutline(jaw);jaw.clip();jawOutline(jaw);jaw.clip();jaw.drawImage(portrait,0,0);
 };
 portrait.src='driver-avatars/cody-slack-black-shirt.png';

 function newCody(){return {x:maze.player.x,y:maze.player.y,dir:'left',next:'left',prog:0,moving:false,face:-1}}
 function newSalads(){
  const spots=[maze.exit,...maze.house];
  return SALADS.map((s,i)=>({...s,i,x:spots[i].x,y:spots[i].y,dir:'left',prog:0,moving:false,home:i>0,release:[0,2,5,8][i],fright:false}));
 }
 function resetBoard(){chips=new Set(maze.chips);burgers=new Set(maze.burgers)}
 function resetActors(){cody=newCody();salads=newSalads();modeClock=0;powerLeft=0;burgerStreak=0}
 function pause(seconds,text,then){pauseTimer=seconds;message=text;afterPause=then;state='pause'}
 function startGame(){level=1;score=0;lives=3;extraLifeGiven=false;resetBoard();resetActors();hud();pause(1.6,'READY!',()=>{state='playing';message=''});tone(523,.12);setTimeout(()=>tone(659,.12),130);setTimeout(()=>tone(784,.2),260)}
 function addScore(n){
  score+=n;if(!extraLifeGiven&&score>=10000){extraLifeGiven=true;lives++;say('Extra life! Second breakfast!')}
  if(score>best){best=score;try{localStorage.setItem('cody_burger_chase_best_v1',String(best))}catch(_){}}
  hud();
 }
 function hud(){$('score').textContent=score;$('best').textContent=best;$('level').textContent=level;$('lives').textContent='♥'.repeat(Math.max(0,lives))||'–'}
 let sayTimer=0;function say(text){$('quip').textContent=text;clearTimeout(sayTimer);sayTimer=setTimeout(()=>{$('quip').textContent=''},2200)}

 // Moves an actor along the grid; decide() runs at each tile centre and returns the next direction or null to stop.
 function travel(a,distance,decide,arrive){
  let guard=0;
  while(distance>0&&guard++<8){
   if(!a.moving){const d=decide(a);if(!d)return;a.dir=d;a.moving=true}
   const need=1-a.prog;
   if(distance<need){a.prog+=distance;return}
   distance-=need;a.prog=0;a.moving=false;
   a.x=((a.x+DIRS[a.dir][0])%maze.w+maze.w)%maze.w;a.y+=DIRS[a.dir][1];
   arrive&&arrive(a);
  }
 }
 function pos(a){return {x:a.x+(a.moving?DIRS[a.dir][0]*a.prog:0),y:a.y+(a.moving?DIRS[a.dir][1]*a.prog:0)}}
 function setDirection(d){
  if(!d)return;
  if(state==='title'||state==='over'){startGame();return}
  cody.next=d;
  if(cody.moving&&d===OPP[cody.dir]){cody.x=((cody.x+DIRS[cody.dir][0])%maze.w+maze.w)%maze.w;cody.y+=DIRS[cody.dir][1];cody.prog=1-cody.prog;cody.dir=d}
 }

 function update(dt){
  chomp+=dt;flash+=dt;bite=Math.max(0,bite-dt);bonus=bonus.filter(b=>(b.t-=dt)>0);
  if(state==='pause'){pauseTimer-=dt;if(pauseTimer<=0){const f=afterPause;afterPause=null;f&&f()}return}
  if(state==='dying'){deathTime+=dt;if(deathTime>1.4)afterDeath();return}
  if(state!=='playing')return;
  const set=levelSettings(level);
  if(powerLeft>0){powerLeft-=dt;if(powerLeft<=0){powerLeft=0;salads.forEach(s=>s.fright=false)}}
  else{const before=modeAt(modeClock);modeClock+=dt;if(modeAt(modeClock)!==before)salads.forEach(s=>{if(!s.home&&s.moving){reverse(s)}})}

  travel(cody,set.codySpeed*dt,a=>{
   if(!isWall(maze,a.x+DIRS[a.next][0],a.y+DIRS[a.next][1]))return a.next;
   if(!isWall(maze,a.x+DIRS[a.dir][0],a.y+DIRS[a.dir][1]))return a.dir;
   return null;
  },eat);
  if(state!=='playing')return;
  if(cody.dir==='left')cody.face=-1;else if(cody.dir==='right')cody.face=1;

  const mode=modeAt(modeClock);
  salads.forEach(s=>{
   if(s.home){s.release-=dt;if(s.release<=0){s.home=false;s.x=maze.exit.x;s.y=maze.exit.y;s.prog=0;s.moving=false;s.dir=Math.random()<.5?'left':'right'}return}
   const speed=s.fright?set.burgerSpeed:(s.y===9&&(s.x<4||s.x>14)?set.saladSpeed*.55:set.saladSpeed);
   travel(s,speed*dt,a=>chooseDir(maze,a.x,a.y,a.dir,mode==='scatter'?CORNERS[a.i]:chaseTarget(a.i,cody,salads),a.fright?Math.random:null));
  });
  collide();
 }
 function reverse(s){if(!s.moving)return;s.x=((s.x+DIRS[s.dir][0])%maze.w+maze.w)%maze.w;s.y+=DIRS[s.dir][1];s.prog=1-s.prog;s.dir=OPP[s.dir]}
 function eat(a){
  const k=a.x+','+a.y;
  if(chips.delete(k)){addScore(10);bite=.12;if(sound&&chomp-lastChip>.09){tone(chips.size%2?392:330,.05,'square',.04);lastChip=chomp}}
  if(burgers.delete(k)){
   addScore(50);bite=.35;powerLeft=levelSettings(level).powerTime;burgerStreak=0;
   salads.forEach(s=>{if(!s.home){s.fright=true;reverse(s)}});
   say(['BURGER TIME!','Salads are on the menu now!','Get in, double cheese!','Lunch is served!'][Math.floor(Math.random()*4)]);tone(196,.25,'sawtooth',.06);
  }
  if(!chips.size&&!burgers.size){
   say('Belly full! Next level.');tone(784,.15);setTimeout(()=>tone(988,.25),160);
   pause(2,'LEVEL '+level+' CLEAR',()=>{level++;resetBoard();resetActors();hud();pause(1.4,'READY!',()=>{state='playing';message=''})});
  }
 }
 function collide(){
  const c=pos(cody);
  for(const s of salads){
   if(s.home)continue;const p=pos(s);let dx=Math.abs(p.x-c.x);dx=Math.min(dx,maze.w-dx);
   if(dx*dx+(p.y-c.y)**2>0.45)continue;
   if(s.fright){
    const pts=BURGER_POINTS[Math.min(burgerStreak++,3)];addScore(pts);bonus.push({x:p.x,y:p.y,text:String(pts),t:1});
    s.fright=false;s.home=true;s.release=3;const spot=maze.house[s.i%3];s.x=spot.x;s.y=spot.y;s.prog=0;s.moving=false;
    bite=.35;tone(880,.08,'square',.06);setTimeout(()=>tone(1175,.1,'square',.06),80);
   } else {
    state='dying';deathTime=0;say(['Got salad-ed!','Not the '+s.name.toLowerCase()+'!','Ugh, vegetables.','Five a day got me.'][Math.floor(Math.random()*4)]);
    tone(330,.2,'triangle');setTimeout(()=>tone(247,.2,'triangle'),200);setTimeout(()=>tone(165,.4,'triangle'),400);return;
   }
  }
 }
 function afterDeath(){
  lives--;hud();
  if(lives<=0){state='over';message='GAME OVER';return}
  resetActors();pause(1.4,'READY!',()=>{state='playing';message=''});
 }

 // ---------- Drawing ----------
 function drawMaze(){
  ctx.fillStyle='#060a18';ctx.fillRect(0,0,W,H);
  for(let y=0;y<maze.h;y++)for(let x=0;x<maze.w;x++){
   const c=MAZE[y][x];
   if(c==='-'){ctx.fillStyle='#ffb8df';ctx.fillRect(x*T,y*T+T/2-1,T,3);continue}
   if(c!=='#')continue;
   ctx.fillStyle='#14246b';ctx.fillRect(x*T,y*T,T,T);
   ctx.fillStyle='#4f7dff';
   if(!isWall(maze,x,y-1)&&y>0)ctx.fillRect(x*T,y*T,T,2);
   if(!isWall(maze,x,y+1)&&y<maze.h-1)ctx.fillRect(x*T,y*T+T-2,T,2);
   if(x>0&&!isWall(maze,x-1,y))ctx.fillRect(x*T,y*T,2,T);
   if(x<maze.w-1&&!isWall(maze,x+1,y))ctx.fillRect(x*T+T-2,y*T,2,T);
  }
 }
 function drawChip(x,y){ctx.fillStyle='#ffd34d';ctx.fillRect(x*T+6,y*T+5,2,6);ctx.fillRect(x*T+9,y*T+6,2,5);ctx.fillStyle='#e0a826';ctx.fillRect(x*T+6,y*T+10,5,1)}
 function drawBurger(cx,cy,size,flashWhite){
  const s=size/16,x=cx-size/2,y=cy-size/2,r=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x+a*s,y+b*s,w*s,h*s)};
  const bun=flashWhite?'#ffffff':'#e8a54b';
  r(3,2,10,1,bun);r(2,3,12,3,bun);r(4,3,1,1,'#fff6d5');r(8,4,1,1,'#fff6d5');r(11,3,1,1,'#fff6d5');
  r(1,6,14,1,'#5fc23a');r(2,7,12,1,'#ffcf3a');r(2,8,12,3,flashWhite?'#bbbbbb':'#6b3a1f');r(2,11,12,3,bun);
 }
 function drawSalad(s){
  const p=pos(s),cx=p.x*T+T/2,cy=p.y*T+T/2;
  if(s.fright){const blink=powerLeft<2&&Math.floor(flash*6)%2===0;drawBurger(cx,cy,T*1.15,blink);return}
  const r=T*.55,wob=Math.floor(flash*8)%2;
  ctx.fillStyle=s.body;ctx.beginPath();ctx.arc(cx,cy-1,r,Math.PI,0);ctx.lineTo(cx+r,cy+r);
  for(let i=0;i<4;i++){const bx=cx+r-(i+.5)*(r/2);ctx.lineTo(bx,cy+r-(i%2===wob?3:0));}
  ctx.lineTo(cx-r,cy+r);ctx.closePath();ctx.fill();
  ctx.fillStyle=s.dark;ctx.fillRect(cx-r+2,cy+r-4,2*r-4,1);
  // A little leafy top so each salad reads at a glance.
  ctx.fillStyle=s.i===1?'#c9f29b':'#2f8f2f';ctx.fillRect(cx-2,cy-r-3,4,3);ctx.fillRect(cx-4,cy-r-2,2,2);ctx.fillRect(cx+2,cy-r-2,2,2);
  const [dx,dy]=DIRS[s.dir];
  for(const ex of [-3.5,3.5]){ctx.fillStyle='#fff';ctx.fillRect(cx+ex-2.5,cy-4,5,6);ctx.fillStyle='#1b2a6b';ctx.fillRect(cx+ex-1+dx*1.5,cy-2+dy*1.5,2.5,2.5)}
 }
 function drawCody(){
  const p=pos(cody),cx=p.x*T+T/2,cy=p.y*T+T/2;
  let size=T*1.8;
  ctx.save();
  if(state==='dying'){const k=Math.min(1,deathTime/1.2);size*=1-k;ctx.translate(cx,cy);ctx.rotate(k*Math.PI*3);drawHead(size,.9*(1-k));ctx.restore();return}
  // Chomps about four times a second while moving, with a wider bite just after eating.
  const open=cody.moving?(0.5-0.5*Math.cos(chomp*Math.PI*8)):0.08;
  ctx.translate(cx,cy-1+(cody.moving?Math.sin(chomp*Math.PI*8)*0.5:0));ctx.scale(cody.face,1);
  drawHead(size,Math.min(1,open+(bite>0?0.35:0)));ctx.restore();
 }
 // Draws the head centred on the origin; open runs from 0 (shut) to 1 (wide open).
 function drawHead(size,open){
  const k=size/CROP.size,drop=open*110*k;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;
  ctx.drawImage(headTop,-size/2,-size/2,size,size);
  ctx.shadowColor='transparent';
  // Stretch the cheeks down with the jaw so the sides of the face stay joined.
  for(let d=0;d<drop;d+=Math.max(.5,drop/8))ctx.drawImage(headJaw,-size/2,-size/2+d,size,size);
  // Inside of the mouth, revealed as the jaw drops.
  const mx=(620-CROP.x-CROP.size/2)*k,my=(832-CROP.y-CROP.size/2)*k;
  if(drop>0.2){
   ctx.fillStyle='#3a0b0e';ctx.beginPath();ctx.ellipse(mx,my+drop/2-4*k,130*k,drop/2+24*k,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#b8434b';ctx.beginPath();ctx.ellipse(mx,my+drop*0.8,70*k,drop*0.3+3*k,0,0,Math.PI*2);ctx.fill();
  }
  ctx.drawImage(headJaw,-size/2,-size/2+drop,size,size);
  ctx.drawImage(headTop,-size/2,-size/2,size,size);
  ctx.imageSmoothingEnabled=false;
 }
 function draw(){
  drawMaze();
  chips.forEach(k=>{const [x,y]=k.split(',').map(Number);drawChip(x,y)});
  const pulse=1+Math.sin(flash*6)*.12;
  burgers.forEach(k=>{const [x,y]=k.split(',').map(Number);drawBurger(x*T+T/2,y*T+T/2,T*.95*pulse)});
  if(state!=='title')salads.forEach(drawSalad);
  if(state!=='title')drawCody();
  ctx.font='10px Pixel, monospace';ctx.textAlign='center';
  bonus.forEach(b=>{ctx.fillStyle='#7ff0ff';ctx.fillText(b.text,b.x*T+T/2,b.y*T+T/2-(1-b.t)*8)});
  const overlay=$('overlay');
  if(state==='title'){overlay.hidden=false;overlay.querySelector('strong').textContent="CODY'S BURGER CHASE";overlay.querySelector('span').textContent='Tap, swipe or press an arrow to start'}
  else if(state==='over'){overlay.hidden=false;overlay.querySelector('strong').textContent='GAME OVER';overlay.querySelector('span').textContent='Score '+score+(score>=best&&score>0?' · New best!':'')+' · Tap to play again'}
  else if(state==='paused'){overlay.hidden=false;overlay.querySelector('strong').textContent='PAUSED';overlay.querySelector('span').textContent='Tap to carry on'}
  else overlay.hidden=true;
  if(state==='pause'&&message){ctx.font='14px Pixel, monospace';ctx.fillStyle='#ffd34d';ctx.fillText(message,W/2,maze.exit.y*T+T*2+11)}
 }
 function frame(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;update(dt);draw();requestAnimationFrame(frame)}

 // ---------- Sound (off by default) ----------
 function tone(freq,length,type='square',volume=.05){
  if(!sound)return;
  try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+length);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+length)}catch(_){}
 }

 // ---------- Controls ----------
 const KEYS={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'};
 document.addEventListener('keydown',e=>{
  if(KEYS[e.key]){e.preventDefault();setDirection(KEYS[e.key])}
  else if(e.key===' '||e.key==='p'||e.key==='P'){e.preventDefault();togglePause()}
 });
 document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();setDirection(b.dataset.dir)}));
 const stage=$('stage');let swipe=null;
 stage.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY,moved:false};stage.setPointerCapture?.(e.pointerId)});
 stage.addEventListener('pointermove',e=>{
  if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  swipe.moved=true;if(state==='playing'||state==='pause')setDirection(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
  swipe.x=e.clientX;swipe.y=e.clientY;
 });
 stage.addEventListener('pointerup',()=>{if(swipe&&!swipe.moved){if(state==='title'||state==='over')startGame();else if(state==='paused')togglePause()}swipe=null});
 function togglePause(){if(state==='playing'){state='paused';$('pause').textContent='Resume'}else if(state==='paused'){state='playing';$('pause').textContent='Pause'}}
 $('pause').addEventListener('click',togglePause);
 $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));tone(660,.08)});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')togglePause()});

 resetBoard();resetActors();hud();requestAnimationFrame(frame);
})(typeof window==='undefined'?globalThis:window);
