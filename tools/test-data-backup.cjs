const {test}=require('node:test');
const assert=require('node:assert/strict');
const b=require('../data-backup.js');
const weeks=JSON.stringify({version:1,weeks:{'2026-10-11':{entries:[]},'2026-10-18':{entries:[]}}});
test('a backup round-trips and is summarised for the restore prompt',()=>{
 const backup=b.build({timesheet_weeks_v1_jak_stewart:weeks,ts_auth_user:'Jak Stewart'},[{key:'Jak|1',claim:{rows:{}}}],new Date('2026-10-15T12:00:00Z'));
 const back=b.check(JSON.parse(JSON.stringify(backup)));
 assert.equal(back.localStorage.ts_auth_user,'Jak Stewart');
 assert.deepEqual(b.summary(back),{weeks:2,expenses:1,date:'15 Oct 2026'});
});
test('files that aren’t backups are refused with a clear reason',()=>{
 assert.throws(()=>b.check(null),/isn’t an MDS Timesheet backup/);
 assert.throws(()=>b.check({format:'other'}),/isn’t an MDS Timesheet backup/);
 assert.throws(()=>b.check({format:b.FORMAT,version:2}),/different version/);
 assert.throws(()=>b.check({format:b.FORMAT,version:1,localStorage:{a:1},expenses:[]}),/damaged/);
 assert.throws(()=>b.check({format:b.FORMAT,version:1,localStorage:{},expenses:[{}]}),/damaged/);
});
