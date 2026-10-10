// Weather on the Log page and seasonal decorations. Only shown to Jak Stewart, in the 8-bit and Pac-Man themes.
(function(root){
 'use strict';
 const THEMES=['arcade','pacman'],OWNER='Jak Stewart';
 function shownFor(theme,user){return THEMES.includes(theme)&&user===OWNER}

 // Christmas runs to Twelfth Night, Halloween is its last week and Bonfire Night covers the weekend either side.
 function seasonFor(date,override){
  if(['christmas','halloween','bonfire'].includes(override))return override;
  if(override==='none')return null;
  const m=date.getMonth()+1,d=date.getDate();
  if(m===12||(m===1&&d<=5))return 'christmas';
  if(m===10&&d>=24)return 'halloween';
  if(m===11&&d>=4&&d<=6)return 'bonfire';
  return null;
 }
 // Open-Meteo WMO weather codes.
 function weatherInfo(code,isDay){
  const c=Number(code),night=Number(isDay)===0;
  if(c<=1)return {icon:night?'night':'sun',label:c===0?'Clear':'Mostly clear',effect:null,amount:0};
  if(c===2)return {icon:night?'night':'partly',label:'Partly cloudy',effect:null,amount:0};
  if(c===3)return {icon:'cloud',label:'Overcast',effect:null,amount:0};
  if(c===45||c===48)return {icon:'fog',label:'Fog',effect:null,amount:0};
  if(c>=51&&c<=57)return {icon:'rain',label:'Drizzle',effect:'rain',amount:.35};
  if(c>=61&&c<=67)return {icon:'rain',label:c>=65?'Heavy rain':c>=63?'Rain':'Light rain',effect:'rain',amount:c>=65?1:c>=63?.7:.45};
  if(c>=71&&c<=77)return {icon:'snow',label:c>=75?'Heavy snow':'Snow',effect:'snow',amount:c>=75?1:.6};
  if(c>=80&&c<=82)return {icon:'rain',label:c===82?'Heavy showers':'Showers',effect:'rain',amount:c===82?1:.7};
  if(c===85||c===86)return {icon:'snow',label:'Snow showers',effect:'snow',amount:.8};
  if(c>=95)return {icon:'thunder',label:'Thunderstorm',effect:'thunder',amount:1};
  return {icon:'cloud',label:'Cloudy',effect:null,amount:0};
 }
 function quipFor(w){
  const info=weatherInfo(w.code,w.isDay);
  if(info.effect==='thunder')return 'Thunder about. Stay off the ladders.';
  if(info.effect==='snow')return 'Snow! Take it steady in the van.';
  if(info.effect==='rain')return info.amount>=.9?'Proper soaker. Keep the tools dry.':'Wet one on site. Pack the waterproofs.';
  if(w.wind>=30)return 'Blowy one. Careful up the ladders.';
  if(info.icon==='fog')return 'Foggy. Take it steady on the roads.';
  if(w.min<=1)return 'Freezing. De-ice the van before you set off.';
  if(w.max>=24)return 'Scorcher. Get the suncream on.';
  if(w.rainChance>=60)return 'Dry for now, but rain is on the way.';
  return info.icon==='cloud'?'Grey but dry.':'Dry day. Good one for outside work.';
 }
 const SEASON_LINES={christmas:'Merry Christmas from the MDS crew!',halloween:'Happy Halloween. Cody’s after your sweets.',bonfire:'Remember, remember the 5th of November.'};
 function forecastUrl(lat,lon){
  return 'https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(2)+'&longitude='+lon.toFixed(2)+
   '&current=temperature_2m,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'+
   '&timezone=auto&forecast_days=1&wind_speed_unit=mph';
 }
 function townUrl(name){return 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&countryCode=GB&name='+encodeURIComponent(name)}
 function parseForecast(j){
  const c=(j&&j.current)||{},d=(j&&j.daily)||{},first=a=>Array.isArray(a)&&a[0]!=null?Math.round(a[0]):null;
  if(c.weather_code==null||c.temperature_2m==null)throw new Error('Forecast missing current weather');
  return {code:c.weather_code,isDay:c.is_day,temp:Math.round(c.temperature_2m),wind:Math.round(c.wind_speed_10m||0),max:first(d.temperature_2m_max),min:first(d.temperature_2m_min),rainChance:first(d.precipitation_probability_max)};
 }

 const api={THEMES,OWNER,shownFor,seasonFor,weatherInfo,quipFor,forecastUrl,townUrl,parseForecast,SEASON_LINES};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 root.MDSWeatherSeason=api;

 // ---------- Page ----------
 const $=id=>document.getElementById(id),html=document.documentElement;
 const SETTINGS_KEY='mds_weather_v1',CACHE_KEY='mds_weather_cache_v1',STALE=30*60*1000;
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const seasonOverride=new URLSearchParams(location.search).get('season');
 function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}}
 function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
 function settings(){return {effects:true,...(read(SETTINGS_KEY)||{})}}
 function saveSettings(s){write(SETTINGS_KEY,s)}
 function signedIn(){try{return localStorage.getItem('ts_auth_user')}catch(_){return null}}
 function allowed(){return shownFor(html.dataset.appTheme,signedIn())}
 function season(){return seasonFor(new Date(),seasonOverride)}
 function effectsOn(){return allowed()&&settings().effects!==false}
 function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n}
 function button(text,action,className){const b=el('button',className,text);b.type='button';b.addEventListener('click',action);return b}

 // Pixel weather icons: one letter per pixel.
 const COLORS={y:'#ffd34d',w:'#f2f4ff',g:'#a9b3cf',d:'#6c7699',b:'#6fb6ff',s:'#dff3ff',m:'#f6e7a1'};
 const ICONS={
  sun:['y...y...y','.y..y..y.','...yyy...','..yyyyy..','yyyyyyyyy','..yyyyy..','...yyy...','.y..y..y.','y...y...y'],
  night:['...mmm...','..mm.....','.mm......','.mm....w.','.mm......','.mm..w...','..mm.....','...mmm...','.........'],
  partly:['.....y..y','......yy.','....yyyyy','..www.yy.','.wwwww..y','wwwwwwww.','wwwwwwwww','.ggggggg.','.........'],
  cloud:['.........','.........','...www...','..wwwww..','.wwwwwww.','wwwwwwwww','wwwwwwwww','.ggggggg.','.........'],
  fog:['.........','ggggggg..','.........','..ggggggg','.........','gggggggg.','.........','.gggggggg','.........'],
  rain:['...ggg...','..ggggg..','.ggggggg.','ggggggggg','.ddddddd.','.........','.b..b..b.','b..b..b..','.........'],
  snow:['...www...','..wwwww..','.wwwwwww.','wwwwwwwww','.ggggggg.','.........','.s..s..s.','...s..s..','.s..s..s.'],
  thunder:['...ddd...','..ddddd..','.ddddddd.','ddddddddd','.ddyyddd.','...yy....','..yyyy...','...yy....','..y......']
 };
 function pixelIcon(name){
  const rows=ICONS[name]||ICONS.cloud,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 '+rows[0].length+' '+rows.length);svg.setAttribute('shape-rendering','crispEdges');svg.setAttribute('aria-hidden','true');
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(!COLORS[c])return;const r=document.createElementNS(ns,'rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',1);r.setAttribute('height',1);r.setAttribute('fill',COLORS[c]);svg.append(r)}));
  return svg;
 }

 // ---------- Weather data ----------
 let loading=false,error='',townOpen=false;
 function place(){return settings().place||null}
 function cache(){const c=read(CACHE_KEY),p=place();return c&&p&&c.key===p.lat.toFixed(2)+','+p.lon.toFixed(2)?c:null}
 async function fetchJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
 function locate(){return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Location is not available on this device'));return}
  navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),e=>reject(new Error(e.code===1?'Location is blocked. Allow it in your browser settings, or enter a town.':'Could not find your location. Try again or enter a town.')),{maximumAge:10*60*1000,timeout:15000});
 })}
 async function refresh(force){
  const p=place();if(!p||loading||!allowed())return;
  const c=cache();if(!force&&c&&Date.now()-c.at<STALE){applyEffects();return}
  loading=true;error='';render();
  try{
   if(p.mode==='gps'){try{const here=await locate();const s=settings();s.place={...p,...here};saveSettings(s)}catch(_){}}
   const now=place(),data=parseForecast(await fetchJSON(forecastUrl(now.lat,now.lon)));
   write(CACHE_KEY,{key:now.lat.toFixed(2)+','+now.lon.toFixed(2),at:Date.now(),data});
  }catch(e){error=navigator.onLine===false?'You’re offline. Showing the last forecast.':'Couldn’t get the weather. Tap refresh to try again.'}
  loading=false;render();applyEffects();
 }
 async function useLocation(){
  loading=true;error='';render();
  try{const here=await locate();const s=settings();s.place={mode:'gps',name:'Your location',...here};saveSettings(s);loading=false;townOpen=false;await refresh(true)}
  catch(e){loading=false;error=e.message;render()}
 }
 async function useTown(name){
  name=name.trim();if(!name)return;
  loading=true;error='';render();
  try{
   const found=(await fetchJSON(townUrl(name))).results?.[0];
   if(!found)throw new Error('Couldn’t find “'+name+'”. Check the spelling.');
   const s=settings();s.place={mode:'town',name:found.name,lat:found.latitude,lon:found.longitude};saveSettings(s);loading=false;townOpen=false;await refresh(true);
  }catch(e){loading=false;error=e.message.startsWith('HTTP')||e.name==='TypeError'?'Couldn’t look that town up. Check your signal.':e.message;render()}
 }

 // ---------- Weather card ----------
 function render(){
  const bar=document.querySelector('#page-log .week-ending-bar');
  let card=$('mds-weather');
  if(!allowed()){card?.remove();return}
  if(!bar)return;
  if(!card){card=el('div','card mds-weather');card.id='mds-weather';card.setAttribute('aria-live','polite')}
  if(card.nextElementSibling!==bar)bar.before(card);
  if(card.contains(document.activeElement)&&document.activeElement.tagName==='INPUT')return;
  card.replaceChildren();
  const p=place(),c=cache(),s=season();
  if(c){
   const w=c.data,info=weatherInfo(w.code,w.isDay),main=el('div','mds-weather-main');
   const icon=el('span','mds-weather-icon');icon.append(pixelIcon(info.icon));
   const now=el('div','mds-weather-now');now.append(el('strong',undefined,w.temp+'°'),el('span',undefined,info.label));
   const day=el('div','mds-weather-day');
   day.append(el('span',undefined,(w.max!=null?'H '+w.max+'°':'')+(w.min!=null?'  L '+w.min+'°':'')));
   if(w.rainChance!=null)day.append(el('span',undefined,'Rain '+w.rainChance+'%'));
   day.append(el('span',undefined,'Wind '+w.wind+' mph'));
   main.append(icon,now,day);card.append(main,el('p','mds-weather-quip',quipFor(w)));
  } else {
   card.append(el('h2',undefined,'Weather on site'),el('p','mds-weather-note',p?'Getting the forecast…':'See today’s weather for where you’re working.'));
  }
  if(s){
   const row=el('div','mds-weather-season-row');row.append(el('p','mds-weather-season',SEASON_LINES[s]));
   if(s==='halloween'&&settings().effects!==false)row.append(buildPumpkin());
   card.append(row);
  }
  if(error)card.append(el('p','mds-weather-error',error));
  const actions=el('div','mds-weather-actions');
  if(p){
   actions.append(button(loading?'Updating…':'↻ '+p.name,()=>refresh(true)),button('Change place',()=>{townOpen=!townOpen;render()}));
  } else {
   actions.append(button(loading?'Finding you…':'Use my location',useLocation),button('Enter a town',()=>{townOpen=!townOpen;render()}));
  }
  const fx=button('Effects: '+(settings().effects===false?'off':'on'),()=>{const st=settings();st.effects=st.effects===false;saveSettings(st);applySeason();render()});
  fx.setAttribute('aria-pressed',String(settings().effects!==false));actions.append(fx);card.append(actions);
  if(townOpen){
   const form=el('form','mds-weather-town'),input=el('input');input.type='text';input.placeholder='Town or postcode area, e.g. Leeds';input.setAttribute('aria-label','Town');input.autocomplete='off';
   form.append(input,el('button',undefined,'Go'));if(p)form.append(button('Use my location',useLocation));
   form.addEventListener('submit',e=>{e.preventDefault();useTown(input.value)});card.append(form);
  }
  if(c){const t=new Date(c.at);card.append(el('p','mds-weather-note','Updated '+t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+' · Forecast from Open-Meteo'))}
 }

 // ---------- Seasonal decorations ----------
 function applySeason(){
  const s=allowed()&&settings().effects!==false?season():null;
  html.dataset.mdsSeason=s||'';
  let lights=$('mds-lights');
  if(s==='christmas'){
   const header=document.querySelector('#mds-app header');
   if(header&&!lights){
    lights=el('div','mds-lights');lights.id='mds-lights';lights.setAttribute('aria-hidden','true');
    const n=Math.max(8,Math.ceil(innerWidth/28));
    for(let i=0;i<n;i++){const b=el('span','mds-bulb mds-bulb-'+(i%4));b.style.animationDelay=(-Math.random()*1.6).toFixed(2)+'s';lights.append(b)}
    header.before(lights);
   }
  } else lights?.remove();
  applyEffects();
 }
 const JOKES=['Trick or treat? Treat. Always treat.','I’m not scared of ghosts. Salads, though…','Pumpkin spice burger, anyone?','Boo! Did I make you jump?','This costume is 90% pumpkin, 10% bacon roll.'];
 function buildPumpkin(){
  const b=el('button','mds-pumpkin');b.id='mds-pumpkin';b.type='button';b.setAttribute('aria-label','Pumpkin Cody. Tap for a Halloween joke.');
  const c=el('canvas');c.width=c.height=48;b.append(c);
  const g=c.getContext('2d'),face=new Image();
  const draw=()=>{
   g.clearRect(0,0,48,48);g.imageSmoothingEnabled=false;
   g.fillStyle='#3f8f2a';g.fillRect(22,3,4,7);g.fillStyle='#5fc23a';g.fillRect(26,5,6,3);
   g.fillStyle='#ff8a1f';g.beginPath();g.ellipse(24,28,22,18,0,0,Math.PI*2);g.fill();
   g.fillStyle='#d4600f';for(const x of [10,17,31,38])g.fillRect(x,14,2,28);
   g.fillStyle='#7a3200';g.beginPath();g.ellipse(24,28,12,13,0,0,Math.PI*2);g.fill();
   if(face.complete&&face.naturalWidth){g.save();g.beginPath();g.ellipse(24,28,10.5,11.5,0,0,Math.PI*2);g.clip();g.imageSmoothingEnabled=true;g.drawImage(face,360,420,540,560,13,16,22,23);g.restore()}
  };
  face.onload=draw;face.src='driver-avatars/cody-slack-black-shirt.png';draw();
  b.addEventListener('click',()=>{const joke=JOKES[Math.floor(Math.random()*JOKES.length)];if(typeof showToast==='function')showToast('🎃 '+joke);b.classList.remove('mds-boo');void b.offsetWidth;b.classList.add('mds-boo')});
  return b;
 }

 // ---------- Animated effects: rain, snow, lightning, bats and fireworks ----------
 const fx={canvas:null,ctx:null,raf:0,last:0,drops:[],bats:[],rockets:[],sparks:[],flash:0,nextFlash:0,nextBat:0,nextRocket:0,weather:null,season:null,w:0,h:0};
 const BAT=[['k.....k','kk.k.kk','.kkkkk.','...k...'],['...k...','.kkkkk.','kk.k.kk','k.....k']];
 const FIREWORK_COLORS=['#ffd34d','#ff6b6b','#7ff0ff','#a8f06b','#ff9de2','#ffffff'];
 function applyEffects(){
  const c=cache(),info=c?weatherInfo(c.data.code,c.data.isDay):null;
  fx.weather=info&&info.effect?info:null;fx.season=season();
  const wanted=effectsOn()&&!reducedMotion.matches&&!document.hidden&&(fx.weather||fx.season==='halloween'||fx.season==='bonfire');
  if(!wanted){stopEffects();return}
  if(!fx.canvas){fx.canvas=el('canvas','mds-fx');fx.canvas.setAttribute('aria-hidden','true');document.body.append(fx.canvas);fx.ctx=fx.canvas.getContext('2d');resize();fx.drops=[]}
  seedDrops();
  if(!fx.raf){fx.last=performance.now();fx.raf=requestAnimationFrame(tick)}
 }
 function stopEffects(){if(fx.raf)cancelAnimationFrame(fx.raf);fx.raf=0;fx.canvas?.remove();fx.canvas=null;fx.drops=[];fx.bats=[];fx.rockets=[];fx.sparks=[]}
 function resize(){if(!fx.canvas)return;const dpr=Math.min(2,devicePixelRatio||1);fx.w=innerWidth;fx.h=innerHeight;fx.canvas.width=fx.w*dpr;fx.canvas.height=fx.h*dpr;fx.ctx.setTransform(dpr,0,0,dpr,0,0)}
 function seedDrops(){
  const w=fx.weather,kind=w?(w.effect==='snow'?'snow':'rain'):null,want=!w?0:Math.round((kind==='snow'?25+50*w.amount:40+90*w.amount)*Math.min(1.6,fx.w/400));
  fx.drops=fx.drops.filter(d=>d.kind===kind).slice(0,want);
  while(fx.drops.length<want)fx.drops.push(newDrop(kind,true));
 }
 function newDrop(kind,anywhere){
  const y=anywhere?Math.random()*fx.h:-10;
  return kind==='snow'?{kind,x:Math.random()*fx.w,y,v:25+Math.random()*45,phase:Math.random()*6.3,size:Math.random()<.3?4:2}:{kind,x:Math.random()*fx.w,y,v:420+Math.random()*260,len:6+Math.round(Math.random()*6)};
 }
 function tick(now){
  const dt=Math.min(.05,(now-fx.last)/1000);fx.last=now;const g=fx.ctx,W=fx.w,H=fx.h;
  g.clearRect(0,0,W,H);
  for(const d of fx.drops){
   if(d.kind==='snow'){d.y+=d.v*dt;d.phase+=dt*1.5;d.x+=Math.sin(d.phase)*12*dt;g.fillStyle='rgba(240,248,255,.85)';g.fillRect(Math.round(d.x),Math.round(d.y),d.size,d.size)}
   else {d.y+=d.v*dt;d.x+=d.v*.12*dt;g.fillStyle='rgba(140,190,255,.55)';g.fillRect(Math.round(d.x),Math.round(d.y),2,d.len)}
   if(d.y>H+10||d.x>W+10)Object.assign(d,newDrop(d.kind,false));
  }
  if(fx.weather&&fx.weather.effect==='thunder'){
   if(now>fx.nextFlash){fx.flash=.18;fx.nextFlash=now+5000+Math.random()*7000}
   if(fx.flash>0){g.fillStyle='rgba(255,255,255,'+(fx.flash*1.8).toFixed(2)+')';g.fillRect(0,0,W,H);fx.flash-=dt}
  }
  if(fx.season==='halloween'){
   if(now>fx.nextBat){const left=Math.random()<.5;fx.bats.push({x:left?-20:W+20,y:H*(.12+Math.random()*.45),v:(left?1:-1)*(80+Math.random()*60),t:0});fx.nextBat=now+3500+Math.random()*5000}
   fx.bats=fx.bats.filter(b=>{b.t+=dt;b.x+=b.v*dt;const y=b.y+Math.sin(b.t*4)*10;drawSprite(g,BAT[Math.floor(b.t*8)%2],b.x,y,3,{k:'#9b6bd6'});g.fillStyle='#ff4040';g.fillRect(Math.round(b.x)+9,Math.round(y)+3,2,2);return b.x>-40&&b.x<W+40});
  }
  if(fx.season==='bonfire'){
   if(now>fx.nextRocket){fx.rockets.push({x:W*(.15+Math.random()*.7),y:H+5,v:-(H*.55+Math.random()*H*.25),top:H*(.12+Math.random()*.3),color:FIREWORK_COLORS[Math.floor(Math.random()*FIREWORK_COLORS.length)]});fx.nextRocket=now+1400+Math.random()*2600}
   fx.rockets=fx.rockets.filter(r=>{r.y+=r.v*dt;g.fillStyle='#ffe0a0';g.fillRect(Math.round(r.x),Math.round(r.y),2,5);
    if(r.y>r.top)return true;
    for(let i=0;i<28;i++){const a=i/28*Math.PI*2,s=60+Math.random()*80;fx.sparks.push({x:r.x,y:r.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1.1+Math.random()*.5,color:r.color})}
    return false});
   fx.sparks=fx.sparks.filter(p=>{p.life-=dt;p.vy+=70*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)return false;g.globalAlpha=Math.min(1,p.life);g.fillStyle=p.color;g.fillRect(Math.round(p.x),Math.round(p.y),3,3);g.globalAlpha=1;return true});
  }
  fx.raf=requestAnimationFrame(tick);
 }
 function drawSprite(g,rows,x,y,px,colors){rows.forEach((row,r)=>[...row].forEach((c,i)=>{if(colors[c]){g.fillStyle=colors[c];g.fillRect(Math.round(x+i*px),Math.round(y+r*px),px,px)}}))}

 // ---------- Wiring ----------
 function update(){render();applySeason();if(allowed())refresh(false)}
 new MutationObserver(update).observe(html,{attributes:true,attributeFilter:['data-app-theme']});
 // The Log view is rebuilt on load; put the card back if it goes missing.
 const app=$('mds-app');
 if(app)new MutationObserver(()=>{if(allowed()&&!$('mds-weather')&&document.querySelector('#page-log .week-ending-bar'))render();if(allowed()&&season()==='christmas'&&settings().effects!==false&&!$('mds-lights'))applySeason()}).observe(app,{childList:true,subtree:true});
 // Signing in or out shows or hides the login screen.
 const login=$('loginScreen');
 if(login)new MutationObserver(update).observe(login,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEffects();else{refresh(false);applyEffects()}});
 addEventListener('resize',()=>{resize();if(fx.canvas)seedDrops()});
 reducedMotion.addEventListener?.('change',applyEffects);
 setInterval(()=>{if(!document.hidden)refresh(false)},STALE);
 addEventListener('load',update);update();
})(typeof window==='undefined'?globalThis:window);
