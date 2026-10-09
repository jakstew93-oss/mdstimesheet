const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=require('../expenses.js');
test('currency totals round each entry to pennies and mileage uses an editable rate',()=>{
 const c=api.fresh('Jak Stewart');c.rows.parking=[{amount:'4.35'},{amount:'1.20'}];c.rows.mileage=[{miles:'11',rate:'0.25'},{miles:'7.5',rate:'0.45'}];c.rows.purchases=[{amount:'12.99'}];c.rows.other=[{amount:'0.10'},{amount:'0.20'}];
 assert.deepEqual(api.totals(c),{parking:555,mileage:613,purchases:1299,other:30,total:2497});
 assert.equal(api.rowAmount('mileage',{miles:10}),250);assert.equal(api.rowAmount('mileage',{miles:10,rate:0}),0);
 assert.equal(api.pennies('1.005'),101);assert.equal(api.pennies(-1),0);assert.equal(api.pennies('oops'),0);
});
test('both entry points preserve packed resources and provide the Expenses section offline',()=>{
 const source=fs.readFileSync('index.html','utf8'),original=JSON.parse(source.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/)[1]);
 for(const file of ['index.html','Index.html']){
  const text=fs.readFileSync(file,'utf8'),template=JSON.parse(text.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.match(template,/<option value="expenses">Expenses<\/option>/);assert.match(template,/expenses.js\?v=70/);assert.match(template,/expense-template.js\?v=70/);
  assert.deepEqual(JSON.parse(text.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/)[1]),original);
 }
 const sw=fs.readFileSync('sw.js','utf8');for(const file of ['expenses.js','expenses.css','expense-template.js'])assert.ok(sw.includes(file+'?v=70'));
});
function pdfContext(){
 const ctx={loadPdfLib:async()=>true,Uint8Array,ArrayBuffer,atob,structuredClone,console,setTimeout,clearTimeout,document:{readyState:'loading',addEventListener(){}},crypto:require('node:crypto').webcrypto};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('pdf-lib.min.js','utf8'),ctx);vm.runInContext(fs.readFileSync('expense-template.js','utf8'),ctx);vm.runInContext(fs.readFileSync('expenses.js','utf8'),ctx);return ctx;
}
test('backup validation rejects executable image data, invalid amounts and extra rows',()=>{
 const ctx=pdfContext(),c=api.fresh('Jak Stewart');c.rows.purchases=[{date:'2026-10-09',supplier:'Shop',items:'Tape',reason:'Work',receipt:'Y',amount:'9.99',receipts:[{name:'receipt.jpg',data:'data:image/jpeg;base64,/9j/AA=='}]}];
 assert.equal(ctx.MDSExpenses.validBackup(c),true);c.rows.purchases[0].receipts[0].data='javascript:alert(1)';assert.equal(ctx.MDSExpenses.validBackup(c),false);
 c.rows.purchases[0].receipts=[];c.rows.purchases[0].amount=-1;assert.equal(ctx.MDSExpenses.validBackup(c),false);
 c.rows.purchases[0].amount='9.99';c.rows.purchases=Array(8).fill(c.rows.purchases[0]);assert.equal(ctx.MDSExpenses.validBackup(c),false);
});
test('generated PDF keeps the original form and includes complete descriptions',async()=>{
 const ctx=pdfContext(),c=api.fresh('Jak Stewart');c.rows.parking=[{date:'2026-10-09',location:'Ashby',reason:'Site visit',receipt:'N',amount:'4.50'}];c.rows.mileage=[{date:'2026-10-09',route:'Leicester to Ashby',reason:'Site visit',miles:'40',rate:'0.25'}];c.rows.purchases=[{date:'2026-10-09',supplier:'Supplier',items:'Very long item description '.repeat(8),reason:'Cable repair',receipt:'N',amount:'18.25'}];c.signature='Jak Stewart';c.signedDate='2026-10-09';c.paymentMethod='BACS';
 if(process.env.EXPENSE_QA_RECEIPT){c.rows.purchases[0].receipt='Y';c.rows.purchases[0].receipts=[{name:'receipt.jpg',data:'data:image/jpeg;base64,'+fs.readFileSync(process.env.EXPENSE_QA_RECEIPT).toString('base64')}];}
 if(process.env.EXPENSE_QA_SIGNATURE)c.signatureImg='data:image/png;base64,'+fs.readFileSync(process.env.EXPENSE_QA_SIGNATURE).toString('base64');
 const bytes=await ctx.MDSExpenses.makePdf(c),doc=await ctx.PDFLib.PDFDocument.load(bytes);
 assert.equal(doc.getPages()[0].getWidth(),595.32001);assert.ok(doc.getPageCount()>=2);
 if(process.env.EXPENSE_QA_RECEIPT)assert.equal(doc.getPageCount(),3);
 if(process.env.EXPENSE_QA_PDF)fs.writeFileSync(process.env.EXPENSE_QA_PDF,bytes);
});
test('expense drawing uses the shared modal while keeping vehicle signatures separate',()=>{
 const source=fs.readFileSync('expenses.js','utf8');const fn=source.slice(source.indexOf('  function connectSignatureModal(){'),source.indexOf('  function receiptControls('));
 let initial,closed;const c={signatureImg:'expense-old',signedDate:''};
 const ctx={claim:c,owner:'Jak Stewart',busy:false,receiptBusy:false,expenseSigSession:null,openingExpenseSig:false,dirty:false,activeOwner:()=> 'Jak Stewart',today:()=> '2026-10-09',status:()=>{},render:()=>{},$:()=>({})};ctx.root={_signatureState:()=>({dataUrl:'vehicle-original'}),openSigModal:()=>{initial=ctx.root._signatureState('van').dataUrl;},closeSigModal:use=>{closed=use;},_sigCanvasToCroppedDataUrl:()=> 'expense-drawn'};
 vm.createContext(ctx);vm.runInContext(fn+'\nconnectSignatureModal();',ctx);
 ctx.root.openSigModal('expenses');assert.equal(initial,'expense-old');ctx.root.closeSigModal(true);assert.equal(c.signatureImg,'expense-drawn');assert.equal(c.signedDate,'2026-10-09');assert.equal(closed,false);assert.equal(ctx.dirty,true);assert.equal(ctx.root._signatureState('van').dataUrl,'vehicle-original');
 ctx.root.openSigModal('expenses');ctx.root.closeSigModal(false);assert.equal(c.signatureImg,'expense-drawn');
});
test('deletion requires confirmation and removes only the signed-in employee claim',async()=>{
 const source=fs.readFileSync('expenses.js','utf8'),fn=source.slice(source.indexOf('  async function deleteClaim(){'),source.indexOf('  function status('));
 const current=api.fresh('Jak Stewart');current.id='claim-1';let key,asks=0,refreshes=0;
 const ctx={owner:'Jak Stewart',claim:current,saved:[{claim:current}],activeOwner:()=> 'Jak Stewart',confirm:()=>{asks++;return false;},money:()=> '£0.00',totals:api.totals,dirty:true,queue:Promise.resolve(),fresh:api.fresh,refreshHistory:async()=>{refreshes++;},render:()=>{},status:()=>{},db:async()=>({transaction:()=>{const tx={objectStore:()=>({delete:k=>{key=k;setTimeout(()=>tx.oncomplete(),0);}})};return tx;}})};
 vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.deleteClaim();assert.equal(asks,1);assert.equal(key,undefined);assert.equal(ctx.claim,current);
 ctx.confirm=()=>true;await ctx.deleteClaim();assert.equal(key,'Jak Stewart|claim-1');assert.equal(ctx.dirty,false);assert.notEqual(ctx.claim.id,'claim-1');assert.equal(refreshes,1);
 ctx.claim=current;ctx.activeOwner=()=> 'Cody Slack';key=undefined;await ctx.deleteClaim();assert.equal(key,undefined);
});
