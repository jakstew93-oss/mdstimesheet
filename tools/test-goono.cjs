const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('../goono-engine.js');

// A repeatable "random" so games can be replayed.
function seeded(n){let h=n>>>0||1;return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%100000)/100000}}
const card=(colour,kind,value=null,id)=>({id:id||'t'+Math.random().toString(36).slice(2),colour,kind,value});
// A game with known hands and a known top card.
function rigged(hands,topCard,rules={}){
 const s=G.newGame(hands.map((_,i)=>({name:'P'+i})),rules,seeded(1));
 s.players.forEach((p,i)=>{p.hand=hands[i]});s.discard=[topCard];s.colour=topCard.colour;s.turn=0;s.dir=1;
 return s;
}

test('the deck has the classic 108 cards',()=>{
 const deck=G.makeDeck();
 assert.equal(deck.length,108);
 assert.equal(deck.filter(c=>c.kind==='wild').length,4);
 assert.equal(deck.filter(c=>c.kind==='wild4').length,4);
 assert.equal(deck.filter(c=>c.colour==='red').length,25);
 assert.equal(new Set(deck.map(c=>c.id)).size,108,'every card has its own id');
});

test('a new game deals everyone their cards and starts on a number',()=>{
 const s=G.newGame([{name:'Jak'},{name:'Cody'},{name:'Ash'}],{handSize:5},seeded(7));
 assert.deepEqual(s.players.map(p=>p.hand.length),[5,5,5]);
 assert.equal(s.discard[0].kind,'num');
 assert.equal(s.colour,s.discard[0].colour);
 assert.equal(s.draw.length+15+1,108);
});

test('you can play on the same colour or the same number',()=>{
 const red5=card('red','num',5),blue5=card('blue','num',5),red9=card('red','num',9),green2=card('green','num',2);
 const s=rigged([[blue5,red9,green2],[card('blue','num',1)]],red5);
 assert.deepEqual(G.playable(s,0).sort(),[blue5.id,red9.id].sort());
 assert.equal(G.apply(s,0,{type:'play',card:green2.id}).ok,false);
 assert.equal(G.apply(s,0,{type:'play',card:blue5.id}).ok,true);
 assert.equal(s.colour,'blue');assert.equal(s.turn,1);
});

test('it has to be your go',()=>{
 const s=rigged([[card('red','num',1)],[card('red','num',2,'x')]],card('red','num',5));
 assert.match(G.apply(s,1,{type:'play',card:'x'}).error,/not your go/);
});

test('Tea Break skips, Wrong Way Van reverses, and with two players reverse is a skip',()=>{
 let s=rigged([[card('red','skip',null,'s'),card('red','num',1)],[card('red','num',2)],[card('red','num',3)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'s'});assert.equal(s.turn,2);
 s=rigged([[card('red','reverse',null,'r'),card('red','num',1)],[card('red','num',2)],[card('red','num',3)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'r'});assert.equal(s.dir,-1);assert.equal(s.turn,2);
 s=rigged([[card('red','reverse',null,'r'),card('red','num',1)],[card('red','num',2)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'r'});assert.equal(s.turn,0,'two players: you go again');
});

test('a Snag List makes the next player pick up 2 and miss their go',()=>{
 const s=rigged([[card('red','draw2',null,'d'),card('red','num',1)],[card('blue','num',2)],[card('green','num',3)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'d'},seeded(3));
 assert.equal(s.players[1].hand.length,3);assert.equal(s.turn,2);
});

test('wilds need a colour, and +4 only when you have no card of the current colour',()=>{
 const w=card(null,'wild',null,'w'),w4=card(null,'wild4',null,'w4');
 let s=rigged([[w,w4,card('red','num',1)],[card('blue','num',2)]],card('red','num',5));
 assert.equal(G.canPlay(s,0,w4),false,'has a red card');
 assert.match(G.apply(s,0,{type:'play',card:'w'}).error,/Pick a colour/);
 assert.equal(G.apply(s,0,{type:'play',card:'w',colour:'green'}).ok,true);
 assert.equal(s.colour,'green');
 s=rigged([[w4,card('blue','num',1)],[card('blue','num',2)],[card('blue','num',3)]],card('red','num',5));
 assert.equal(G.apply(s,0,{type:'play',card:'w4',colour:'blue'},seeded(2)).ok,true);
 assert.equal(s.players[1].hand.length,5);assert.equal(s.turn,2);
 s=rigged([[w4,card('red','num',1)],[card('blue','num',2)]],card('red','num',5),{wild4Anytime:true});
 assert.equal(G.canPlay(s,0,w4),true,'house rule: +4 any time');
});

test('stacking passes the pick-up on until someone can’t add to it',()=>{
 const s=rigged([[card('red','draw2',null,'a'),card('red','num',1)],[card('blue','draw2',null,'b'),card('blue','num',1)],[card('green','num',3),card('green','num',4)]],card('red','num',5),{stacking:true});
 G.apply(s,0,{type:'play',card:'a'});
 assert.equal(s.pendingDraw,2);assert.equal(s.turn,1);
 assert.deepEqual(G.playable(s,1),['b'],'only another +2 can go down');
 G.apply(s,1,{type:'play',card:'b'});
 assert.equal(s.pendingDraw,4);assert.equal(s.turn,2);
 assert.deepEqual(G.playable(s,2),[]);
 G.apply(s,2,{type:'draw'},seeded(4));
 assert.equal(s.players[2].hand.length,6);assert.equal(s.pendingDraw,0);assert.equal(s.turn,0);
});

test('picking up: play the card you picked up, or pass',()=>{
 const s=rigged([[card('blue','num',1)],[card('green','num',2)]],card('red','num',5));
 s.draw.push(card('red','num',7,'pick'));
 G.apply(s,0,{type:'draw'});
 assert.equal(s.drewCard,'pick');assert.equal(s.turn,0);
 assert.deepEqual(G.playable(s,0),['pick'],'only the card you picked up');
 assert.equal(G.apply(s,0,{type:'pass'}).ok,true);assert.equal(s.turn,1);
});

test('picking up a card you can’t play passes your go straight away',()=>{
 const s=rigged([[card('blue','num',1)],[card('green','num',2)]],card('red','num',5));
 s.draw.push(card('green','num',8));
 G.apply(s,0,{type:'draw'});
 assert.equal(s.turn,1);assert.equal(s.drewCard,null);
});

test('house rule: keep picking up until you can play',()=>{
 const s=rigged([[card('blue','num',1)],[card('green','num',2)]],card('red','num',5),{drawUntilPlayable:true});
 s.draw.push(card('red','num',3,'good'),card('green','num',8),card('blue','num',9));
 G.apply(s,0,{type:'draw'});
 assert.equal(s.players[0].hand.length,4);assert.equal(s.drewCard,'good');
});

test('Goono: forget to shout it and you can be caught for 2; shout it and you’re safe',()=>{
 let s=rigged([[card('red','num',1,'a'),card('red','num',2)],[card('blue','num',3),card('blue','num',4)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'a'});
 assert.equal(s.players[0].caughtable,true);
 assert.equal(G.apply(s,1,{type:'catch',target:0},seeded(5)).ok,true);
 assert.equal(s.players[0].hand.length,3);
 s=rigged([[card('red','num',1,'a'),card('red','num',2)],[card('blue','num',3),card('blue','num',4)]],card('red','num',5));
 G.apply(s,0,{type:'goono'});G.apply(s,0,{type:'play',card:'a'});
 assert.equal(s.players[0].caughtable,false);
 assert.match(G.apply(s,1,{type:'catch',target:0}).error,/safe/);
 assert.match(G.apply(rigged([[card('red','num',1),card('red','num',2),card('red','num',3)],[card('red','num',4)]],card('red','num',5)),0,{type:'goono'}).error,/last two/);
});

test('once the next card goes down it’s too late to catch them',()=>{
 const s=rigged([[card('red','num',1,'a'),card('red','num',2)],[card('red','num',3,'b'),card('blue','num',4)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'a'});G.apply(s,1,{type:'play',card:'b'});
 assert.equal(s.players[0].caughtable,false);
});

test('going out wins the game',()=>{
 const s=rigged([[card('red','num',1,'a')],[card('blue','num',3)]],card('red','num',5));
 G.apply(s,0,{type:'play',card:'a'});
 assert.equal(s.phase,'over');assert.equal(s.winner,0);
 assert.match(G.apply(s,1,{type:'draw'}).error,/over/);
});

test('house rule: jump in with an identical card out of turn',()=>{
 const s=rigged([[card('blue','num',1)],[card('green','num',2)],[card('red','num',5,'same'),card('blue','num',9)]],card('red','num',5),{jumpIn:true});
 assert.deepEqual(G.viewFor(s,2).playable,['same']);
 assert.equal(G.apply(s,2,{type:'play',card:'same'}).ok,true);
 assert.equal(s.turn,0,'play carries on from the player who jumped in');
 const plain=rigged([[card('blue','num',1)],[card('green','num',2)],[card('red','num',5,'same'),card('blue','num',9)]],card('red','num',5));
 assert.match(G.apply(plain,2,{type:'play',card:'same'}).error,/not your go/);
});

test('house rule: 7 swaps hands, 0 passes every hand on',()=>{
 let s=rigged([[card('red','num',7,'seven'),card('red','num',1),card('red','num',2)],[card('blue','num',3)],[card('green','num',4),card('green','num',5)]],card('red','num',5),{sevenZero:true});
 assert.match(G.apply(s,0,{type:'play',card:'seven'}).error,/swap/);
 G.apply(s,0,{type:'play',card:'seven',target:1});
 assert.equal(s.players[0].hand.length,1);assert.equal(s.players[1].hand.length,2);
 s=rigged([[card('red','num',0,'zero'),card('red','num',1)],[card('blue','num',3,'b')],[card('green','num',4,'g1'),card('green','num',5,'g2')]],card('red','num',5),{sevenZero:true});
 G.apply(s,0,{type:'play',card:'zero'});
 assert.deepEqual(s.players[1].hand.map(c=>c.value),[1],'P1 now has P0’s hand');
 assert.deepEqual(s.players[2].hand.map(c=>c.id),['b']);
 assert.deepEqual(s.players[0].hand.map(c=>c.id),['g1','g2']);
});

test('each player only sees their own hand',()=>{
 const s=G.newGame([{name:'Jak'},{name:'Cody'}],{},seeded(9));
 const v=G.viewFor(s,1);
 assert.deepEqual(v.hand,s.players[1].hand);
 assert.equal(JSON.stringify(v).includes(s.players[0].hand[0].id)&&!v.hand.some(c=>c.id===s.players[0].hand[0].id)&&v.top.id!==s.players[0].hand[0].id,false,'no one else’s card ids leak');
 assert.deepEqual(v.players.map(p=>p.count),[7,7]);
});

test('rules from the host are cleaned up',()=>{
 assert.deepEqual(G.cleanRules({handSize:99,stacking:'yes',jumpIn:true,evil:1}),{...G.DEFAULT_RULES,jumpIn:true});
 assert.equal(G.cleanRules({handSize:10}).handSize,10);
});

test('computer players can finish whole games under any rules',()=>{
 for(const [name,rules] of Object.entries({classic:G.PRESETS.classic,chaos:G.PRESETS.chaos,drawUntil:{drawUntilPlayable:true}})){
  for(let g=0;g<25;g++){
   const rand=seeded(1000+g),s=G.newGame([{name:'A',bot:true},{name:'B',bot:true},{name:'C',bot:true},{name:'D',bot:true}],rules,rand);
   let moves=0;
   while(s.phase==='play'&&moves<5000){
    const p=s.turn,m=G.botMove(s,p,rand);
    const r=G.apply(s,p,m,rand);assert.equal(r.ok,true,name+': '+JSON.stringify(m)+' '+r.error);
    // Someone may catch a player who forgot to shout Goono.
    s.players.forEach((x,i)=>{if(x.caughtable&&rand()<0.3){const c=(i+1)%4;G.apply(s,c,{type:'catch',target:i},rand)}});
    moves++;
   }
   assert.equal(s.phase,'over',name+' game '+g+' finished');
   const total=s.players.reduce((n,x)=>n+x.hand.length,0)+s.draw.length+s.discard.length;
   assert.equal(total,108,name+': no cards lost or duplicated');
  }
 }
});

test('Goono is in the secret arcade and cached for offline play',()=>{
 assert.match(fs.readFileSync('spark-town-launcher.js','utf8'),/name:'Goono'[^}]*path:'goono\.html\?v=\d+'/);
 const sw=fs.readFileSync('sw.js','utf8');
 for(const f of ['goono.html','goono-engine.js','peerjs.min.js'])assert.ok(sw.includes('./'+f),f);
});

test('every phone is told what just happened, without giving away picked-up cards',()=>{
 const s=rigged([[card('red','draw2',null,'d'),card('red','num',1)],[card('blue','num',2)],[card('green','num',3)]],card('red','num',5));
 s.events=[];
 G.apply(s,0,{type:'play',card:'d'},seeded(3));
 const types=s.events.map(e=>e.type);
 assert.deepEqual(types,['play','hit','draw']);
 assert.equal(s.events[0].by,0);assert.equal(s.events[0].card.id,'d');
 assert.deepEqual({by:s.events[2].by,n:s.events[2].n},{by:1,n:2});
 assert.equal('card' in s.events[2],false,'picked-up cards stay secret');
 assert.ok(s.events[1].id<s.events[2].id,'events are numbered in order');
 const v=G.viewFor(s,2);assert.deepEqual(v.events.map(e=>e.type),types);
 const s2=G.newGame([{name:'A'},{name:'B'}],{},seeded(4));
 assert.equal(s2.events[0].type,'deal');
});
