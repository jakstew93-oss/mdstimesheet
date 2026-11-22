// Goono: the rules, with no screen or network code, so they can be tested (tools/test-goono.cjs).
// The host's phone keeps the one true copy of the game; everyone else only ever sees their own hand.
(function(root){
 'use strict';
 const COLOURS=['red','yellow','green','blue'];
 const COLOUR_NAMES={red:'Red',yellow:'Yellow',green:'Green',blue:'Blue'};
 // The special cards, crew style.
 const KINDS={
  num:{label:''},
  skip:{label:'Tea Break',short:'⛔',help:'Next player misses a go.'},
  reverse:{label:'Wrong Way Van',short:'🔄',help:'Play goes the other way.'},
  draw2:{label:'Snag List',short:'+2',help:'Next player picks up 2.'},
  wild:{label:'Goono',short:'🌈',help:'Choose the colour.'},
  wild4:{label:'Mum’s Calling',short:'+4',help:'Choose the colour. Next player picks up 4.'},
 };
 const DEFAULT_RULES={
  handSize:7,           // cards each at the start
  stacking:false,       // put +2 on +2 (and +4 on +2 or +4) to pass it on
  drawUntilPlayable:false, // keep picking up until you get a card you can play
  jumpIn:false,         // play an identical card out of turn
  sevenZero:false,      // 7 swaps hands with someone, 0 passes everyone's hand round
  wild4Anytime:false,   // +4 even when you have a card of the current colour
  goonoPenalty:true,    // forget to shout Goono on your last card and get caught: pick up 2
 };
 const PRESETS={
  classic:{...DEFAULT_RULES},
  chaos:{...DEFAULT_RULES,stacking:true,jumpIn:true,sevenZero:true,wild4Anytime:true},
 };

 function cleanRules(r){
  const s={...DEFAULT_RULES};
  if(r&&typeof r==='object'){
   for(const k of Object.keys(DEFAULT_RULES))if(typeof r[k]===typeof DEFAULT_RULES[k])s[k]=r[k];
  }
  s.handSize=[5,7,10].includes(Number(s.handSize))?Number(s.handSize):7;
  return s;
 }

 function makeDeck(){
  const deck=[];let id=0;
  const add=(colour,kind,value)=>deck.push({id:'c'+(id++),colour,kind,value:value==null?null:value});
  for(const c of COLOURS){
   add(c,'num',0);
   for(let v=1;v<=9;v++){add(c,'num',v);add(c,'num',v)}
   for(const k of ['skip','reverse','draw2']){add(c,k);add(c,k)}
  }
  for(let i=0;i<4;i++){add(null,'wild');add(null,'wild4')}
  return deck;
 }
 function shuffle(list,rand){for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]]}return list}
 function cardName(card,colour){
  if(!card)return '';
  if(card.kind==='num')return COLOUR_NAMES[card.colour]+' '+card.value;
  const k=KINDS[card.kind];
  if(!card.colour)return k.label+(colour?' ('+COLOUR_NAMES[colour]+')':'');
  return COLOUR_NAMES[card.colour]+' '+k.label;
 }

 // ---------- A new game ----------
 // players: [{name, bot}]
 function newGame(players,rules,rand=Math.random){
  rules=cleanRules(rules);
  const s={
   players:players.map(p=>({name:String(p.name).slice(0,40),bot:!!p.bot,hand:[],saidGoono:false,caughtable:false})),
   draw:shuffle(makeDeck(),rand),discard:[],colour:null,turn:0,dir:1,
   pendingDraw:0,pendingKind:null,drewCard:null,phase:'play',winner:null,rules,log:[],seq:0,events:[],evId:0,
  };
  for(let i=0;i<rules.handSize;i++)for(const p of s.players)p.hand.push(s.draw.pop());
  // Start on a number card, so the first go is a normal one.
  let first=s.draw.pop();
  while(first.kind!=='num'){s.draw.unshift(first);first=s.draw.pop()}
  s.discard.push(first);s.colour=first.colour;
  s.turn=Math.floor(rand()*s.players.length);
  log(s,'Game on. '+s.players[s.turn].name+' goes first.');
  ev(s,{type:'deal',n:rules.handSize});
  return s;
 }
 function log(s,text){s.log.push(text);if(s.log.length>30)s.log.shift()}
 // What just happened, so every phone can animate it. Played cards are public; picked-up cards are never named.
 function ev(s,e){e.id=++s.evId;s.events.push(e);if(s.events.length>24)s.events.shift()}
 const top=s=>s.discard[s.discard.length-1];
 const next=(s,from=s.turn,steps=1)=>((from+s.dir*steps)%s.players.length+s.players.length)%s.players.length;

 function refill(s,rand){
  if(s.draw.length)return;
  const keep=s.discard.pop();
  s.draw=shuffle(s.discard,rand);s.discard=[keep];
  if(s.draw.length)log(s,'Shuffled the pile.');
 }
 function pickUp(s,p,n,rand){
  const got=[];
  for(let i=0;i<n;i++){refill(s,rand);const c=s.draw.pop();if(!c)break;s.players[p].hand.push(c);got.push(c)}
  if(s.players[p].hand.length>1){s.players[p].saidGoono=false}
  s.players[p].caughtable=false;
  if(got.length)ev(s,{type:'draw',by:p,n:got.length});
  return got;
 }

 // ---------- What can be played ----------
 function canPlay(s,p,card){
  if(s.phase!=='play')return false;
  const t=top(s),hand=s.players[p].hand;
  if(s.pendingDraw>0){
   if(!s.rules.stacking)return false;
   if(card.kind==='wild4')return true;
   return card.kind==='draw2'&&s.pendingKind==='draw2';
  }
  if(s.drewCard&&s.drewCard!==card.id)return false;   // after picking up, only the card you picked up
  if(card.kind==='wild')return true;
  if(card.kind==='wild4')return s.rules.wild4Anytime||!hand.some(c=>c.id!==card.id&&c.colour===s.colour);
  if(card.colour===s.colour)return true;
  if(card.kind==='num')return t.kind==='num'&&t.value===card.value;
  return card.kind===t.kind;
 }
 function playable(s,p){return s.players[p].hand.filter(c=>canPlay(s,p,c)).map(c=>c.id)}
 // Jump-in: an identical card (same colour and number or action) played out of turn.
 function canJumpIn(s,p,card){
  if(!s.rules.jumpIn||s.phase!=='play'||p===s.turn||s.pendingDraw>0||s.drewCard)return false;
  const t=top(s);
  return !!card.colour&&card.colour===t.colour&&card.kind===t.kind&&card.value===t.value;
 }

 // ---------- Moves ----------
 // action: {type:'play', card, colour?, target?} | {type:'draw'} | {type:'pass'} | {type:'goono'} | {type:'catch', target}
 function apply(s,p,action,rand=Math.random){
  if(!action||typeof action!=='object')return fail('That move didn’t make sense.');
  const me=s.players[p];if(!me)return fail('You’re not in this game.');
  if(action.type==='goono'){
   if(me.hand.length>2)return fail('You can only shout Goono on your last two cards.');
   me.saidGoono=true;if(me.caughtable){me.caughtable=false}
   log(s,me.name+': GOONO!');ev(s,{type:'goono',by:p});s.seq++;return ok();
  }
  if(action.type==='catch'){
   const t=Number(action.target),them=s.players[t];
   if(!them||t===p)return fail('Catch who?');
   if(!s.rules.goonoPenalty||!them.caughtable)return fail(them.name+' is safe.');
   ev(s,{type:'catch',by:p,target:t});pickUp(s,t,2,rand);log(s,me.name+' caught '+them.name+' not saying Goono! +2');s.seq++;return ok();
  }
  if(s.phase!=='play')return fail('The game’s over.');
  if(action.type==='play'){
   const card=me.hand.find(c=>c.id===action.card);
   if(!card)return fail('You haven’t got that card.');
   const jumping=p!==s.turn;
   if(jumping){if(!canJumpIn(s,p,card))return fail('It’s not your go.')}
   else if(!canPlay(s,p,card))return fail('You can’t play that card now.');
   if(!card.colour&&!COLOURS.includes(action.colour))return fail('Pick a colour.');
   const seven=s.rules.sevenZero&&card.kind==='num'&&card.value===7&&me.hand.length>1;
   if(seven){const t=Number(action.target);if(!s.players[t]||t===p)return fail('Pick who to swap with.')}
   if(jumping){s.turn=p;log(s,me.name+' jumped in!')}
   // Everyone who forgot to say Goono is safe once the next card goes down.
   s.players.forEach(x=>{if(x!==me)x.caughtable=false});
   me.hand.splice(me.hand.indexOf(card),1);s.discard.push(card);s.drewCard=null;
   s.colour=card.colour||action.colour;
   log(s,me.name+' played '+cardName(card,s.colour)+'.');
   ev(s,{type:'play',by:p,card:{...card},colour:s.colour,jump:jumping});
   if(me.hand.length===1){
    if(me.saidGoono)log(s,me.name+' is on Goono!');
    else me.caughtable=!!s.rules.goonoPenalty;
   }
   if(me.hand.length===0){s.phase='over';s.winner=p;s.pendingDraw=0;log(s,me.name+' wins! 🏆');ev(s,{type:'win',by:p});s.seq++;return ok()}
   if(me.hand.length>1)me.saidGoono=false;
   // Effects
   if(seven){
    const t=Number(action.target);[me.hand,s.players[t].hand]=[s.players[t].hand,me.hand];
    log(s,me.name+' swapped hands with '+s.players[t].name+'.');ev(s,{type:'swap',a:p,b:t});
    [me,s.players[t]].forEach(x=>{x.caughtable=false;if(x.hand.length>1)x.saidGoono=false});
   }
   if(s.rules.sevenZero&&card.kind==='num'&&card.value===0){
    const hands=s.players.map(x=>x.hand),n=hands.length;
    s.players.forEach((x,i)=>{x.hand=hands[((i-s.dir)%n+n)%n];x.caughtable=false;if(x.hand.length>1)x.saidGoono=false});
    log(s,'Everyone passed their hand on!');ev(s,{type:'rotate'});
   }
   let steps=1;
   if(card.kind==='skip'){steps=2;ev(s,{type:'skip',who:next(s)})}
   else if(card.kind==='reverse'){s.dir*=-1;if(s.players.length===2)steps=2;ev(s,{type:'reverse',dir:s.dir})}
   else if(card.kind==='draw2'||card.kind==='wild4'){
    const n=card.kind==='draw2'?2:4;
    if(s.rules.stacking){s.pendingDraw+=n;s.pendingKind=card.kind;ev(s,{type:'stack',who:next(s),total:s.pendingDraw})}
    else{const v=next(s);ev(s,{type:'hit',who:v,n});pickUp(s,v,n,rand);log(s,s.players[v].name+' picks up '+n+' and misses a go.');steps=2}
   }
   s.turn=next(s,s.turn,steps);s.seq++;return ok();
  }
  if(action.type==='draw'){
   if(p!==s.turn)return fail('It’s not your go.');
   if(s.drewCard)return fail('You’ve already picked up. Play it or pass.');
   s.players.forEach(x=>{if(x!==me)x.caughtable=false});
   if(s.pendingDraw>0){
    const n=s.pendingDraw;pickUp(s,p,n,rand);s.pendingDraw=0;s.pendingKind=null;
    log(s,me.name+' picked up '+n+'.');s.turn=next(s);s.seq++;return ok();
   }
   let got=[];
   if(s.rules.drawUntilPlayable){
    for(let i=0;i<108;i++){const c=pickUp(s,p,1,rand)[0];if(!c)break;got.push(c);if(canPlay(s,p,c))break}
   }else got=pickUp(s,p,1,rand);
   log(s,me.name+' picked up '+(got.length===1?'a card':got.length+' cards')+'.');
   const last=got[got.length-1];
   if(last&&canPlay(s,p,last)){s.drewCard=last.id}
   else{s.turn=next(s)}
   s.seq++;return ok();
  }
  if(action.type==='pass'){
   if(p!==s.turn||!s.drewCard)return fail('You can only pass after picking up.');
   s.drewCard=null;log(s,me.name+' passed.');s.turn=next(s);s.seq++;return ok();
  }
  return fail('Unknown move.');
 }
 const ok=()=>({ok:true}),fail=error=>({ok:false,error});

 // What one player is allowed to see.
 function viewFor(s,p){
  return {
   you:p,seq:s.seq,hand:s.players[p]?s.players[p].hand.slice():[],
   players:s.players.map((x,i)=>({name:x.name,bot:x.bot,count:x.hand.length,saidGoono:x.saidGoono,caughtable:x.caughtable})),
   top:top(s),colour:s.colour,turn:s.turn,dir:s.dir,pendingDraw:s.pendingDraw,pendingKind:s.pendingKind,
   drewCard:s.drewCard,phase:s.phase,winner:s.winner,rules:s.rules,log:s.log.slice(-8),drawLeft:s.draw.length,events:s.events.slice(),
   playable:p===s.turn?playable(s,p):s.players[p]?s.players[p].hand.filter(c=>canJumpIn(s,p,c)).map(c=>c.id):[],
  };
 }

 // ---------- Computer players ----------
 function botMove(s,p,rand=Math.random){
  const me=s.players[p];
  if(me.hand.length===2&&!me.saidGoono&&rand()<0.85)return {type:'goono'};
  if(p!==s.turn)return null;
  const ids=playable(s,p);
  if(!ids.length)return s.drewCard?{type:'pass'}:{type:'draw'};
  const cards=me.hand.filter(c=>ids.includes(c.id));
  const nextCount=s.players[next(s)].hand.length;
  const score=c=>{
   if(c.kind==='wild4')return nextCount<=2?9:1;
   if(c.kind==='wild')return 2;
   if(c.kind==='num')return 5+(c.colour===s.colour?1:0);
   return nextCount<=3?8:4;
  };
  cards.sort((a,b)=>score(b)-score(a));
  const card=cards[0],move={type:'play',card:card.id};
  if(!card.colour){
   const counts={};me.hand.forEach(c=>{if(c.colour)counts[c.colour]=(counts[c.colour]||0)+1});
   move.colour=COLOURS.slice().sort((a,b)=>(counts[b]||0)-(counts[a]||0))[0];
  }
  if(s.rules.sevenZero&&card.kind==='num'&&card.value===7&&me.hand.length>1){
   let best=-1;s.players.forEach((x,i)=>{if(i!==p&&(best<0||x.hand.length<s.players[best].hand.length))best=i});move.target=best;
  }
  return move;
 }

 const api={COLOURS,COLOUR_NAMES,KINDS,DEFAULT_RULES,PRESETS,cleanRules,makeDeck,newGame,canPlay,canJumpIn,playable,apply,viewFor,botMove,cardName};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Goono=api;
})(typeof window==='undefined'?globalThis:window);
