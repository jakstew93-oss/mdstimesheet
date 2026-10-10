const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../watch-sync/core.js');
const patch=(id,entryId,changes)=>({id,entryId,kind:'patch',changes});
class DB {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(fs.readFileSync('watch-sync/service/schema.sql','utf8'));}
 prepare(sql){const stmt=this.db.prepare(sql);let args=[];return {bind(...v){args=v;return this},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}}};}
 async batch(statements){this.db.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
async function service(){const worker=(await import('../watch-sync/service/worker.mjs')).default;const DBInstance=new DB();return async(token,path,body,ip='1')=>{const headers={'Content-Type':'application/json','CF-Connecting-IP':ip};if(token)headers.Authorization='Bearer '+token;const response=await worker.fetch(new Request('https://sync.example'+path,{method:'POST',headers,body:JSON.stringify(body)}),{DB:DBInstance});return {status:response.status,body:await response.json()};};}
test('field patches merge and permanent deletes prevent offline resurrection',()=>{
 const rows={};core.apply(rows,patch('a','entry',{jobNumber:'123',startTime:'22:00'}));core.apply(rows,patch('b','entry',{endTime:'02:00'}));assert.equal(rows.entry.startTime,'22:00');
 core.apply(rows,{id:'delete',entryId:'entry',kind:'delete'});core.apply(rows,patch('c','entry',{startTime:'12:00'}));assert.deepEqual(rows.entry,{deleted:true});
 assert.throws(()=>core.validate(patch('x','entry',{startTime:'25:00'})));assert.throws(()=>core.validate(patch('x','__proto__',{jobNumber:'x'})));assert.throws(()=>core.validate(patch('x','entry',{password:'x'})));
});
test('real SQLite queries isolate sessions and retry batches without duplicates',async()=>{
 const call=await service(),token='a'.repeat(64),other='b'.repeat(64),operations=[patch('a','entry',{date:'2026-10-10',id:1791673200000,startTime:'22:00'})];
 let r=await call(token,'/v1/sync',{operations,cursor:0});assert.equal(r.status,200);assert.equal(r.body.operations.length,1);
 r=await call(token,'/v1/sync',{operations,cursor:0});assert.equal(r.body.operations.length,1);assert.deepEqual(r.body.ack,['a']);
 r=await call(other,'/v1/sync',{operations:[],cursor:0});assert.deepEqual(r.body.operations,[]);
 assert.equal((await call('bad','/v1/sync',{operations:[],cursor:0})).status,401);
 assert.equal((await call(token,'/v1/sync',{operations:[patch('invalid','entry',{startTime:'27:00'})],cursor:0})).status,400);
});
test('pair codes are one use and failed redemption attempts are limited',async()=>{
 const call=await service(),token='a'.repeat(64);const pair=await call(token,'/v1/pair',{});assert.match(pair.body.code,/^\d{8}$/);
 const redeemed=await call('','/v1/redeem',{code:pair.body.code});assert.equal(redeemed.body.token,token);
 assert.equal((await call('','/v1/redeem',{code:pair.body.code})).status,404);
 for(let i=0;i<3;i++)await call('','/v1/redeem',{code:'00000000'});
 assert.equal((await call('','/v1/redeem',{code:'00000000'})).status,429);
});
test('cursor pagination does not skip operations across two employees',async()=>{
 const call=await service(),token='a'.repeat(64);for(let n=0;n<5;n++)await call(token,'/v1/sync',{cursor:0,operations:Array.from({length:50},(_,i)=>patch('op'+(n*50+i),'row'+(n*50+i),{jobNumber:'123'}))});
 const a=(await call(token,'/v1/sync',{cursor:0,operations:[]})).body;assert.equal(a.operations.length,200);assert.equal(a.more,true);
 const b=(await call(token,'/v1/sync',{cursor:a.cursor,operations:[]})).body;assert.equal(b.operations.length,50);assert.equal(b.more,false);
 assert.equal(new Set([...a.operations,...b.operations].map(op=>op.id)).size,250);
});
function phone(){
 const data=new Map([['ts_auth_user','Jak Stewart'],['timesheet_employee','Jak Stewart']]);let store={version:1,weeks:{'2026-10-11':{entries:[{id:123,date:'2026-10-10',jobNumber:'123',startTime:'08:00'}]}}};
 const el=()=>({style:{},append(){},addEventListener(){},classList:{contains:()=>true}});const ctx={MDSWatchCore:core,MDSTools:require('../timesheet-tools.js'),crypto:globalThis.crypto,URL,AbortController,console,queueMicrotask:()=>{},setTimeout:()=>0,clearTimeout(){},setInterval(){},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},readWeekStore:()=>structuredClone(store),writeWeekStore:v=>{store=structuredClone(v)},currentWeekEnding:()=> '2026-10-11',calcHours:()=> '8hrs',getBreakMins:()=>20,renderAll(){},document:{hidden:false,head:el(),body:el(),getElementById:()=>el(),createElement:el,addEventListener(){}},addEventListener(){},fetch:()=>{throw Error('offline')}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('watch-sync/phone.js','utf8'),ctx);
 const stateKey='mds_watch_sync_v1_Jak Stewart';data.set(stateKey,JSON.stringify({endpoint:'https://sync.example',token:'a'.repeat(64),rows:{},observed:{},queue:[],cursor:0}));return {ctx,data,stateKey,store:()=>store};
}
test('phone captures edits/deletions durably, calculates pulled entries and keeps offline queue',async()=>{
 const p=phone();p.ctx.MDSWatchSync.capture();let s=JSON.parse(p.data.get(p.stateKey));assert.equal(s.queue.length,1);assert.equal(s.queue[0].changes.jobNumber,'123');
 p.ctx.MDSWatchSync.capture();assert.equal(JSON.parse(p.data.get(p.stateKey)).queue.length,1);
 await p.ctx.MDSWatchSync.sync();assert.equal(JSON.parse(p.data.get(p.stateKey)).queue.length,1);
 const remote=patch('watch','watch-entry',{id:456,date:'2026-10-10',jobNumber:'456',startTime:'08:00',endTime:'16:00'});
 p.ctx.fetch=async()=>({ok:true,json:async()=>({ack:s.queue.map(op=>op.id),operations:[...s.queue,remote],cursor:2,more:false})});
 await p.ctx.MDSWatchSync.sync();assert.equal(JSON.parse(p.data.get(p.stateKey)).queue.length,0);
 const rows=p.store().weeks['2026-10-11'].entries;assert.equal(rows.length,2);assert.equal(rows.find(e=>e.id===456).totalHours,'8hrs');assert.equal(rows.find(e=>e.id===456).breakMins,20);
 p.ctx.writeWeekStore({version:1,weeks:{'2026-10-11':{entries:rows.filter(e=>e.id!==456)}}});assert.equal(JSON.parse(p.data.get(p.stateKey)).queue.at(-1).kind,'delete');
});
test('phone account switch during network response cannot write another employee’s data',async()=>{
 const p=phone();p.ctx.MDSWatchSync.capture();let finish;p.ctx.fetch=()=>new Promise(resolve=>{finish=resolve});const pending=p.ctx.MDSWatchSync.sync();
 p.data.set('ts_auth_user','Other Employee');p.data.set('timesheet_employee','Other Employee');finish({ok:true,json:async()=>({ack:[],operations:[patch('watch','watch-entry',{id:456,date:'2026-10-10',jobNumber:'456'})],cursor:1,more:false})});await pending;
 assert.equal(p.store().weeks['2026-10-11'].entries.length,1);assert.equal(JSON.parse(p.data.get(p.stateKey)).cursor,0);
});
