import core from '../core.js';
const PHONE='https://jakstew93-oss.github.io';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':PHONE,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
export default {async fetch(request,env){
 try{
  if(request.headers.has('Origin')&&request.headers.get('Origin')!==PHONE)return reply({error:'Origin denied'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'POST required'},405);
  const path=new URL(request.url).pathname;
  if(!['/v1/sync','/v1/pair','/v1/redeem'].includes(path))return reply({error:'Not found'},404);
  const text=await request.text();if(text.length>150000)return reply({error:'Request too large'},413);
  const body=JSON.parse(text||'{}'),now=Date.now();
  if(path==='/v1/redeem'){
   // CF-Connecting-IP is provided by Cloudflare, never by the client at the edge.
   const ip=request.headers.get('CF-Connecting-IP')||'local';
   await env.DB.prepare('INSERT INTO attempts(ip,count,expires) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END').bind(ip,now+300000,now,now).run();
   const rate=await env.DB.prepare('SELECT count FROM attempts WHERE ip=?').bind(ip).first();
   if(rate.count>5)return reply({error:'Wait five minutes before trying again'},429);
   if(!/^\d{8}$/.test(body.code||''))return reply({error:'Invalid pairing code'},400);
   const pair=await env.DB.prepare('DELETE FROM pairs WHERE code=? AND expires>? RETURNING token').bind(body.code,now).first();
   if(!pair)return reply({error:'Code expired or already used'},404);
   return reply({token:pair.token});
  }
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'Pair this device first'},401);
  const session=await hash(token);
  if(path==='/v1/pair'){
   await env.DB.prepare('DELETE FROM pairs WHERE expires<=? OR token=?').bind(now,token).run();
   const limit=await env.DB.prepare('SELECT COUNT(*) AS n FROM pairs').first();
   if(limit.n>1000)return reply({error:'Pairing busy, try later'},429);
   for(let n=0;n<5;n++){
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0');
    const result=await env.DB.prepare('INSERT OR IGNORE INTO pairs(code,token,expires) VALUES(?,?,?)').bind(code,token,now+300000).run();
    if(result.meta.changes)return reply({code,expires:now+300000});
   }
   return reply({error:'Pairing busy'},503);
  }
  if(!Array.isArray(body.operations)||body.operations.length>50||!Number.isSafeInteger(body.cursor)||body.cursor<0)return reply({error:'Invalid sync batch'},400);
  const ops=body.operations.map(core.validate);
  if(ops.length)await env.DB.batch(ops.map(op=>env.DB.prepare('INSERT OR IGNORE INTO operations(session,op_id,body) VALUES(?,?,?)').bind(session,op.id,JSON.stringify(op))));
  const {results}=await env.DB.prepare('SELECT seq,body FROM operations WHERE session=? AND seq>? ORDER BY seq LIMIT 200').bind(session,body.cursor).all();
  return reply({ack:ops.map(op=>op.id),operations:results.map(row=>({seq:row.seq,...JSON.parse(row.body)})),cursor:results.at(-1)?.seq||body.cursor,more:results.length===200});
 }catch(error){return reply({error:error instanceof SyntaxError?'Invalid JSON':error.message==='Invalid operation'||error.message?.startsWith('Invalid ')||error.message==='Unsupported field'?error.message:'Sync service unavailable'},error instanceof SyntaxError||error.message?.startsWith('Invalid ')||error.message==='Unsupported field'?400:503);}
}};
