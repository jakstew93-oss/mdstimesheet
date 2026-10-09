/* Expenses are isolated by signed-in employee. Receipts live in IndexedDB, not localStorage. */
(function(root){
  'use strict';
  const categories = {
    parking:{title:'Parking', count:4, fields:[['date','Date','date'],['location','Location'],['reason','Reason'],['receipt','Receipt Y/N','receipt'],['amount','Amount (£)','number']]},
    mileage:{title:'Business Mileage', count:7, fields:[['date','Date','date'],['route','From / To'],['reason','Reason'],['miles','Total Mileage','number'],['rate','£ Per Mile','number']]},
    purchases:{title:'Purchases', count:7, fields:[['date','Date','date'],['supplier','Supplier'],['items','Item(s) Purchased'],['reason','Reason'],['receipt','Receipt Y/N','receipt'],['amount','Amount Incl VAT (£)','number']]},
    other:{title:'Other Expenditures', count:8, fields:[['date','Date','date'],['details','Details'],['reason','Reason'],['receipt','Receipt Y/N','receipt'],['amount','Amount Incl VAT (£)','number']]}
  };
  function pennies(value){ const n=Number(value); return Number.isFinite(n)&&n>=0?Math.round((n+Number.EPSILON)*100):0; }
  function rowAmount(type,row){ return type==='mileage'?pennies(Number(row.miles||0)*Number(row.rate??0.25)):pennies(row.amount); }
  function totals(claim){ const result={}; for(const type of Object.keys(categories)) result[type]=(claim.rows[type]||[]).reduce((sum,row)=>sum+rowAmount(type,row),0); result.total=Object.values(result).reduce((a,b)=>a+b,0); return result; }
  function today(){ const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function fresh(name){return {id:root.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,name,date:today(),signature:'',signedDate:'',paymentMethod:'',paidDate:'',authorisedSignature:'',authorised:{parking:'',mileage:'',purchases:'',other:''},rows:{parking:[],mileage:[],purchases:[],other:[]}};}
  const api={categories,pennies,rowAmount,totals,fresh};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.MDSExpenses=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id), money=n=>'£'+(n/100).toFixed(2);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dbPromise,claim=null,owner='',saved=[],queue=Promise.resolve(),busy=false,receiptBusy=false,dirty=false;
  let expenseSigSession=null,openingExpenseSig=false;
  function activeOwner(){return localStorage.getItem('ts_auth_user')||'';}
  function db(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open('mds-expenses-v1',1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('claims',{keyPath:'key'});};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>{dbPromise=null;reject(new Error('Expense storage is unavailable. Enable browser storage and try again.'));};
    });
    return dbPromise;
  }
  async function records(){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('claims','readonly'),req=tx.objectStore('claims').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function write(snapshot,employee){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('claims','readwrite');tx.objectStore('claims').put({key:employee+'|'+snapshot.id,owner:employee,claim:snapshot,updated:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Unable to save expenses.'));tx.onabort=()=>reject(tx.error||new Error('Unable to save expenses.'));});}
  async function deleteClaim(){
    const employee=owner,current=claim;
    if(!current||employee!==activeOwner()||!saved.some(r=>r.claim.id===current.id))return;
    if(!confirm('Delete the saved claim dated '+current.date+' ('+money(totals(current).total)+') and all its receipt photos?'+(dirty?' Unsaved changes to this claim will also be discarded.':'')+' This cannot be undone.'))return;
    await queue.catch(()=>{});
    if(owner!==employee||activeOwner()!==employee||claim!==current)throw new Error('Your account or claim changed. Select the claim again before deleting.');
    const database=await db();
    await new Promise((resolve,reject)=>{const tx=database.transaction('claims','readwrite');tx.objectStore('claims').delete(employee+'|'+current.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Unable to delete the claim.'));tx.onabort=()=>reject(tx.error||new Error('Unable to delete the claim.'));});
    if(owner!==employee||activeOwner()!==employee)return;
    claim=fresh(employee);dirty=false;await refreshHistory();render();status('Claim and receipt photos deleted. You can start a new claim.');
  }
  function status(text){$('expense-status').textContent=text;}
  function fail(error){console.warn('Expenses:',error);status(error.message||'Unable to complete this action. Please try again.');}
  async function save(){
    if(!claim||owner!==activeOwner())throw new Error('Sign in again before saving expenses.');
    const employee=owner,snapshot=structuredClone(claim);
    const work=queue.catch(()=>{}).then(()=>write(snapshot,employee));queue=work;
    await work;
    if(owner!==employee)return;
    dirty=false;status('Saved on this device.');await refreshHistory();
  }
  async function refreshHistory(){
    const employee=owner;const all=await records();if(owner!==employee)return;
    saved=all.filter(r=>r.owner===employee).sort((a,b)=>b.updated-a.updated);
    $('expense-saved').innerHTML='<option value="">Choose a saved claim</option>'+saved.map(r=>`<option value="${esc(r.claim.id)}" ${r.claim.id===claim?.id?'selected':''}>${esc(r.claim.date)} · ${esc(r.claim.name)} · ${money(totals(r.claim).total)}</option>`).join('');
  }
  function field(key,label,type,value,attrs=''){
    const id='expense-'+key.replace(/\./g,'-');
    const input=type==='receipt'?`<select id="${id}" data-expense="${key}" ${attrs}>${['','Y','N'].map(x=>`<option value="${x}" ${x===value?'selected':''}>${x||'Choose'}</option>`).join('')}</select>`:`<input id="${id}" data-expense="${key}" type="${type||'text'}" value="${esc(value)}" ${type==='number'?'min="0" max="10000000" step="0.01" inputmode="decimal"':''} ${attrs}>`;
    return `<div class="field"><label for="${id}">${esc(label)}</label>${input}</div>`;
  }
  function updateTotals(){
    const t=totals(claim);$('expense-total').textContent='Total claim: '+money(t.total);
    for(const type of Object.keys(categories)){
      $('expense-total-'+type).textContent=money(t[type]);
      document.querySelectorAll(`[data-mileage-total="${type}"]`).forEach(el=>el.textContent='Amount: '+money(rowAmount(type,claim.rows[type][Number(el.dataset.row)])));
    }
  }
  function render(){
    if(!claim)return;
    $('expense-fields').innerHTML=`<div class="card"><h2>Employee Expenses Claim Form</h2><div class="expense-grid">${field('name','Name','text',claim.name)}${field('date','Claim Date','date',claim.date)}</div><p class="expense-note">Fill in your expenses, then attach VAT receipts to the matching entry. Save claims and photos on this device; export a PDF to keep a copy elsewhere.</p></div>`+
      Object.entries(categories).map(([type,cat])=>`<div class="card"><h2>${cat.title} · <span id="expense-total-${type}"></span></h2>${claim.rows[type].map((row,i)=>`<details class="expense-row" open><summary>${cat.title} ${i+1}</summary><div class="expense-grid">${cat.fields.map(([key,label,kind])=>field(`rows.${type}.${i}.${key}`,label,kind,row[key]??'',kind==='number'?'required':'')).join('')}</div>${type==='mileage'?`<p data-mileage-total="mileage" data-row="${i}" class="expense-note"></p>`:receiptControls(type,i,row)}<div class="expense-actions"><button type="button" class="btn btn-secondary" data-remove="${type}" data-row="${i}">Remove entry</button></div></details>`).join('')}<button type="button" class="btn btn-secondary" data-add="${type}" ${claim.rows[type].length>=cat.count?'disabled':''}>Add ${cat.title.toLowerCase()} entry</button><p class="expense-note">${claim.rows[type].length} / ${cat.count} entries per form</p></div>`).join('')+
      `<div class="card"><h2>Employee Signature</h2><div class="field"><label>Signature</label><div class="sig-pad-wrap"><button type="button" id="expense-sign" class="sig-canvas-tap" aria-label="Draw employee signature"><canvas id="expense-signature-canvas"></canvas><span class="sig-tap-hint" id="expense-signature-hint">Tap to sign</span></button><div class="expense-actions">${field('signature','Or type name','text',claim.signature,'placeholder="e.g. J. Stewart"')}<button type="button" id="expense-signature-clear" class="sig-clear-btn">Clear</button></div></div></div>${field('signedDate','Signature Date','date',claim.signedDate)}</div>`;
    updateTotals();setButtons();renderSignature();
  }
  function renderSignature(){
    const canvas=$('expense-signature-canvas');if(!canvas||!claim)return;
    const rect=canvas.parentElement.getBoundingClientRect();canvas.width=rect.width||320;canvas.height=rect.height||110;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);$('expense-signature-hint').style.display=claim.signatureImg?'none':'';
    if(claim.signatureImg){const data=claim.signatureImg,img=new Image();img.onload=()=>{if(canvas.isConnected&&claim?.signatureImg===data){const scale=Math.min(canvas.width/img.width,canvas.height/img.height);ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);}};img.src=data;}
  }
  function connectSignatureModal(){
    const originalOpen=root.openSigModal,originalClose=root.closeSigModal,originalState=root._signatureState;
    root._signatureState=function(context){const state=originalState(context);return openingExpenseSig?{...state,dataUrl:expenseSigSession.claim.signatureImg||''}:state;};
    root.openSigModal=function(context){
      if(context!=='expenses')return originalOpen(context);
      if(!claim||busy||receiptBusy)return;
      expenseSigSession={claim,owner};openingExpenseSig=true;
      try{originalOpen('van');}catch(e){expenseSigSession=null;throw e;}finally{openingExpenseSig=false;}
    };
    root.closeSigModal=function(use){
      if(!expenseSigSession)return originalClose(use);
      const session=expenseSigSession;
      try{
        if(use&&session.claim===claim&&session.owner===activeOwner()){
          claim.signatureImg=root._sigCanvasToCroppedDataUrl($('sigModalCanvas'));
          if(claim.signatureImg&&!claim.signedDate)claim.signedDate=today();
          dirty=true;status('Signature added — tap Save claim.');
        }
      }finally{expenseSigSession=null;originalClose(false);render();}
    };
  }
  function receiptControls(type,i,row){return `<p class="expense-note">Scan a receipt photo to fill its date and total, or enter them manually. Photos are included in your PDF.</p><div class="expense-actions"><button type="button" class="btn btn-secondary" data-camera="${type}" data-row="${i}">Take receipt photo</button><button type="button" class="btn btn-secondary" data-gallery="${type}" data-row="${i}">Choose receipt photos</button></div><div class="expense-receipts">${(row.receipts||[]).map((r,j)=>`<div class="expense-receipt"><a href="${r.data}" target="_blank" rel="noopener" aria-label="Open receipt ${j+1}"><img src="${r.data}" alt="Receipt ${j+1}"></a><button type="button" class="btn btn-secondary" data-receipt-scan="${type}" data-row="${i}" data-index="${j}">Scan date &amp; amount</button><button type="button" class="btn btn-secondary" data-receipt-remove="${type}" data-row="${i}" data-index="${j}">Remove photo ${j+1}</button></div>`).join('')}</div>`;}
  let scannerPromise;
  function scanner(){if(root.MDSReceiptOCR)return Promise.resolve(root.MDSReceiptOCR);if(!scannerPromise)scannerPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./receipt-ocr.js?v=67';s.onload=()=>resolve(root.MDSReceiptOCR);s.onerror=()=>{scannerPromise=null;reject(new Error('Unable to load receipt scanning. Check your connection and try again.'));};document.head.append(s);});return scannerPromise;}
  async function scannedEntry(photo,existing){
    const original=claim,employee=owner,ocr=await scanner();status('Scanning receipt…');const result=await ocr.scan(photo.data);
    if(original!==claim||employee!==activeOwner())throw new Error('Your account or claim changed. Scan the receipt again.');
    const values=await ocr.review(result,{newEntry:!existing,type:existing?.type||'purchases'});if(!values){status('Receipt scan cancelled.');return;}
    if(original!==claim||employee!==activeOwner())throw new Error('Your account or claim changed. Scan the receipt again.');
    let row=existing?.row;
    if(!row){const cat=categories[values.type];if(claim.rows[values.type].length>=cat.count)throw new Error('This form is full for '+cat.title+'. Start a new claim to add this receipt.');row={receipts:[photo]};for(const[key]of cat.fields)row[key]='';claim.rows[values.type].push(row);}
    row.date=values.date;row.amount=values.amount;row.receipt='Y';row.receiptScan={text:result.text,scannedAt:new Date().toISOString(),date:values.date,amount:values.amount};dirty=true;
    render();await save();status('Receipt logged: '+values.date+' · £'+values.amount+'. Saved on this device.');
  }
  function scanPhoto(camera){
    const employee=owner,original=claim,input=document.createElement('input');input.type='file';input.accept='image/*';if(camera)input.setAttribute('capture','environment');
    input.onchange=()=>{if(!input.files.length)return;action(async()=>{if(owner!==employee||claim!==original||activeOwner()!==employee)throw new Error('Your account or claim changed. Select the photo again.');const file=input.files[0];await scannedEntry({name:file.name,data:await imageData(file)});});};input.click();
  }
  function setButtons(){document.querySelectorAll('#section-expenses button,#section-expenses input,#section-expenses select').forEach(el=>{el.disabled=busy||receiptBusy||(el.dataset.add&&claim?.rows[el.dataset.add].length>=categories[el.dataset.add].count)||(el.id==='expense-delete'&&!saved.some(r=>r.claim.id===claim?.id));});}
  function setPath(path,value){const keys=path.split('.');let obj=claim;for(const key of keys.slice(0,-1))obj=obj[key];obj[keys.at(-1)]=value;dirty=true;status('Unsaved changes — tap Save claim.');updateTotals();}
  async function imageData(file){
    if(file.size>30*1024*1024)throw new Error('This photo is too large. Choose one smaller than 30 MB.');
    if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP receipt photo.');
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Unable to read this photo. Choose a JPG or PNG version.'));img.src=url;});
      const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.86);
    }finally{URL.revokeObjectURL(url);}
  }
  function selectReceipts(type,index,camera){
    const employee=owner,original=claim,row=claim.rows[type][index];const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=!camera;if(camera)input.setAttribute('capture','environment');
    input.onchange=async()=>{
      if(!input.files.length)return;
      receiptBusy=true;setButtons();status('Saving receipt photos…');
      try{
        if((row.receipts?.length||0)+input.files.length>10)throw new Error('Attach up to 10 photos per entry.');
        const photos=[];for(const file of input.files)photos.push({name:file.name,data:await imageData(file)});
        if(activeOwner()!==employee||claim!==original)throw new Error('Your account or claim changed. Please attach the photos again.');
        row.receipts=(row.receipts||[]).concat(photos);row.receipt='Y';dirty=true;await save();render();
      }catch(e){if(claim===original)render();fail(e);}finally{receiptBusy=false;setButtons();}
    };input.click();
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function validate(){
    if(!claim.name.trim()||!claim.date)throw new Error('Enter your name and claim date.');
    for(const [type,rows]of Object.entries(claim.rows))for(const [i,row]of rows.entries()){
      if(!row.date)throw new Error(categories[type].title+' '+(i+1)+': enter a date.');
      const keys=type==='mileage'?['miles','rate']:['amount'];
      for(const key of keys)if(row[key]===''||!Number.isFinite(Number(row[key]))||Number(row[key])<0||Number(row[key])>10000000)throw new Error(categories[type].title+' '+(i+1)+': enter a valid '+key+'.');
    }
  }
  function readableDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):value;}
  async function makePdf(snapshot){
    await loadPdfLib();
    const {PDFDocument,StandardFonts,rgb}=PDFLib,pdf=await PDFDocument.load(Uint8Array.from(atob(root.MDS_EXPENSE_TEMPLATE),c=>c.charCodeAt(0))),font=await pdf.embedFont(StandardFonts.Courier),page=pdf.getPages()[0],h=page.getHeight();
    page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.setCharacterSpacing(0),PDFLib.setWordSpacing(0),PDFLib.setCharacterSqueeze(100));
    // Coordinates are measured from the original form's top-left corner.
    const clean=value=>String(value??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7e\xa3]/g,'?');
    function cell(value,x,top,width,height=13.68){
      const text=clean(value);if(!text)return;
      let size=8;while(size>4.5&&font.widthOfTextAtSize(text,size)>width-5)size-=0.25;
      // Wrap long descriptions across two lines, keeping the complete value in the appendix below.
      let lines=[text];if(font.widthOfTextAtSize(text,size)>width-5){let first='';let pos=0;while(pos<text.length&&font.widthOfTextAtSize(first+text[pos],size)<=width-5)first+=text[pos++];lines=[first,text.slice(pos)];while(font.widthOfTextAtSize(lines[1],size)>width-5)lines[1]=lines[1].slice(0,-1);}
      lines.forEach((line,i)=>page.drawText(line,{x:x+2,y:h-top-(height-lines.length*size)/2-size-i*size,size,font,color:rgb(0,0,0)}));
    }
    function cover(x,top,w,height){page.drawRectangle({x,y:h-top-height,width:w,height,color:rgb(1,1,1)});}
    cell(snapshot.name,90.5,103.2,212.5,19);cell(readableDate(snapshot.date),381.3,103.2,198,19);
    const layouts={parking:{top:142.32,step:13.68,x:[30.12,89.88,208.56,380.76,445.08],w:[59.76,118.68,172.2,64.32,67.2],keys:['date','location','reason','receipt','amount'],total:197.04},mileage:{top:230.52,step:13.68,x:[30.12,89.88,208.56,303.36,380.76,445.08],w:[59.76,118.68,94.8,77.4,64.32,67.2],keys:['date','route','reason','miles','rate','calculated'],total:326.28},purchases:{top:359.76,step:13.68,x:[30.12,89.88,208.56,303.36,380.76,445.08],w:[59.76,118.68,94.8,77.4,64.32,67.2],keys:['date','supplier','items','reason','receipt','amount'],total:455.52},other:{top:489.84,step:14.52,x:[30.12,89.88,208.56,380.76,445.08],w:[59.76,118.68,172.2,64.32,67.2],keys:['date','details','reason','receipt','amount'],total:606}};
    const t=totals(snapshot);
    for(const [type,layout]of Object.entries(layouts)){
      if(type==='mileage')for(let i=0;i<7;i++)cover(383,layout.top+i*layout.step+1,60,layout.step-2);
      snapshot.rows[type].forEach((row,i)=>layout.keys.forEach((key,j)=>cell(key==='date'?readableDate(row[key]):key==='calculated'?(rowAmount(type,row)/100).toFixed(2):key==='amount'?(pennies(row[key])/100).toFixed(2):row[key],layout.x[j],layout.top+i*layout.step,layout.w[j],layout.step)));
      cell((t[type]/100).toFixed(2),520,layout.total,59,13.2);
    }
    if(snapshot.signatureImg){const img=await pdf.embedPng(snapshot.signatureImg),scale=Math.min(366/img.width,20/img.height);page.drawImage(img,{x:211,y:h-626.64-23+(23-img.height*scale)/2,width:img.width*scale,height:img.height*scale});}
    else cell(snapshot.signature,209.04,626.64,370,23);
    cell(readableDate(snapshot.signedDate),209.04,650.28,370,23);
    // Office Use Only belongs to the office: leave the source template untouched here,
    // including when an older saved claim still contains office values.
    page.pushOperators(PDFLib.popGraphicsState());
    // The appendix preserves complete descriptions even where the original paper cells are small.
    let appendix=null,y=0;
    function line(text){const s=clean(text);let remainder=s;do{if(!appendix||y<45){appendix=pdf.addPage([595.32,841.92]);y=798;appendix.drawText('Expense claim details',{x:30,y,size:16,font});y-=28;}let part='';while(remainder.length&&font.widthOfTextAtSize(part+remainder[0],10)<530){part+=remainder[0];remainder=remainder.slice(1);}appendix.drawText(part,{x:30,y,size:10,font});y-=15;}while(remainder.length);}
    line(snapshot.name+' | Claim date: '+readableDate(snapshot.date));
    for(const [type,cat]of Object.entries(categories))snapshot.rows[type].forEach((row,i)=>{line(cat.title+' '+(i+1));cat.fields.forEach(([key,label])=>line(label+': '+(key==='date'?readableDate(row[key]):row[key]??'')));line('Amount: '+money(rowAmount(type,row))+' | Photos: '+(row.receipts||[]).length);y-=8;});
    for(const [type,cat]of Object.entries(categories))for(const [i,row]of snapshot.rows[type].entries())for(const [j,receipt]of (row.receipts||[]).entries()){
      const img=await pdf.embedJpg(receipt.data),p=pdf.addPage([595.32,841.92]),scale=Math.min(535.32/img.width,745/img.height);p.drawText(`${cat.title} ${i+1} - Receipt ${j+1}`,{x:30,y:807,size:13,font});p.drawText(clean(snapshot.name+' | '+readableDate(row.date)),{x:30,y:789,size:10,font});p.drawImage(img,{x:(595.32-img.width*scale)/2,y:30+(745-img.height*scale)/2,width:img.width*scale,height:img.height*scale});
    }
    return new Uint8Array(await pdf.save());
  }
  api.makePdf=makePdf;
  async function exportPdf(){validate();await save();status('Creating expense form and receipt pages…');const snapshot=structuredClone(claim),bytes=await makePdf(snapshot),name='Expenses-'+snapshot.date+'.pdf',blob=new Blob([bytes],{type:'application/pdf'});download(blob,name);status('Expense PDF downloaded with receipt photos.');}
  async function sharePdf(){validate();await save();status('Preparing expense PDF…');const snapshot=structuredClone(claim),bytes=await makePdf(snapshot),name='Expenses-'+snapshot.date+'.pdf',file=new File([bytes],name,{type:'application/pdf'});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});status('Expense PDF shared.');}catch(e){if(e.name==='AbortError')status('Share cancelled.');else throw e;}}else{download(file,name);status('Expense PDF downloaded. You can attach it to a message or email.');}}
  function validBackup(c){
    if(!c||typeof c.name!=='string'||typeof c.date!=='string'||!c.rows)return false;
    if(c.signatureImg&&!(typeof c.signatureImg==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.signatureImg)&&c.signatureImg.length<2000000))return false;
    const textKeys=['signature','signedDate','paymentMethod','paidDate','authorisedSignature'];if(textKeys.some(k=>typeof c[k]!=='string'))return false;
    if(!c.authorised||Object.keys(categories).some(k=>!['','Y','N'].includes(c.authorised[k])))return false;
    return Object.entries(categories).every(([type,cat])=>Array.isArray(c.rows[type])&&c.rows[type].length<=cat.count&&c.rows[type].every(row=>row&&cat.fields.every(([key,,kind])=>kind==='number'?(row[key]===''||Number.isFinite(Number(row[key]))&&Number(row[key])>=0&&Number(row[key])<=10000000):typeof row[key]==='string')&&(!row.receipts||Array.isArray(row.receipts)&&row.receipts.length<=10&&row.receipts.every(r=>typeof r.name==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.data)&&r.data.length<12000000))));
  }
  api.validBackup=validBackup;
  async function activate(){
    const employee=activeOwner();if(!employee){$('section-expenses').hidden=true;return;}
    if(employee!==owner||!claim){owner=employee;claim=null;dirty=false;saved=[];status('Loading expenses…');await refreshHistory();if(owner!==employee||activeOwner()!==employee)return;claim=structuredClone(saved[0]?.claim||fresh(employee));render();status(saved.length?'Saved claim loaded from this device.':'New claim — add an expense to begin.');}
  }
  async function action(fn){if(busy||receiptBusy)return;busy=true;setButtons();try{await fn();}catch(e){fail(e);}finally{busy=false;setButtons();}}
  function boot(){
    if(!$('sectionSelect')||typeof root.switchSection!=='function')return;
    const panel=document.createElement('section');panel.id='section-expenses';panel.hidden=true;panel.innerHTML='<div class="card"><div class="expense-history"><div class="field"><label for="expense-saved">Saved claims</label><select id="expense-saved"></select></div><button type="button" id="expense-new" class="btn btn-secondary">New claim</button></div><div class="expense-actions"><button type="button" id="expense-save" class="btn btn-primary">Save claim</button><button type="button" id="expense-export" class="btn btn-secondary">Download PDF</button><button type="button" id="expense-share" class="btn btn-secondary">Share PDF</button></div><p id="expense-status" class="expense-status" role="status" aria-live="polite"></p><div id="expense-total" class="expense-total"></div></div><form id="expense-fields"></form>';
    $('section-holiday').after(panel);
    const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.id='expense-delete';deleteButton.className='btn btn-secondary';deleteButton.textContent='Delete claim';panel.querySelector('.expense-history').append(deleteButton);deleteButton.onclick=()=>action(deleteClaim);
    const scanActions=document.createElement('div');scanActions.className='expense-actions';scanActions.innerHTML='<button type="button" id="expense-scan-camera" class="btn btn-primary">Scan receipt with camera</button><button type="button" id="expense-scan-photo" class="btn btn-secondary">Scan receipt photo</button>';
    panel.querySelector('.expense-actions').before(scanActions);
    $('expense-scan-camera').onclick=()=>scanPhoto(true);$('expense-scan-photo').onclick=()=>scanPhoto(false);
    connectSignatureModal();
    const original=root.switchSection;root.switchSection=function(section){original(section);panel.hidden=section!=='expenses';if(section==='expenses')activate().catch(fail);};
    panel.addEventListener('input',e=>{if(e.target.dataset.expense&&claim)setPath(e.target.dataset.expense,e.target.value);});
    panel.addEventListener('submit',e=>e.preventDefault());
    panel.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||busy||receiptBusy||!claim)return;
      if(b.id==='expense-sign')root.openSigModal('expenses');
      if(b.id==='expense-signature-clear'){claim.signatureImg='';claim.signature='';dirty=true;render();status('Signature cleared — tap Save claim.');}
      const i=Number(b.dataset.row);
      if(b.dataset.add){const type=b.dataset.add;if(claim.rows[type].length>=categories[type].count)return;const row={};for(const[key,,kind]of categories[type].fields)row[key]=kind==='date'?today():key==='rate'?'0.25':'';row.receipts=[];claim.rows[type].push(row);dirty=true;render();status('Unsaved changes — tap Save claim.');}
      if(b.dataset.remove){if(!confirm('Remove this expense entry and its receipt photos?'))return;claim.rows[b.dataset.remove].splice(i,1);dirty=true;render();status('Unsaved changes — tap Save claim.');}
      if(b.dataset.camera)selectReceipts(b.dataset.camera,i,true);
      if(b.dataset.gallery)selectReceipts(b.dataset.gallery,i,false);
      if(b.dataset.receiptScan){const type=b.dataset.receiptScan,row=claim.rows[type][i];action(()=>scannedEntry(row.receipts[Number(b.dataset.index)],{type,row}));}
      if(b.dataset.receiptRemove){if(!confirm('Remove this receipt photo?'))return;const row=claim.rows[b.dataset.receiptRemove][i];row.receipts.splice(Number(b.dataset.index),1);if(!row.receipts.length)row.receipt='N';dirty=true;render();status('Unsaved changes — tap Save claim.');}
    });
    $('expense-save').onclick=()=>action(save);$('expense-export').onclick=()=>action(exportPdf);$('expense-share').onclick=()=>action(sharePdf);
    $('expense-new').onclick=()=>action(async()=>{if(dirty)await save();claim=fresh(owner);render();$('expense-saved').value='';status('New claim — add an expense to begin.');});
    $('expense-saved').onchange=()=>action(async()=>{const id=$('expense-saved').value;if(!id)return;if(dirty)await save();claim=structuredClone(saved.find(r=>r.claim.id===id).claim);render();$('expense-saved').value=id;status('Saved claim loaded.');});
    const login=root.doLogin;root.doLogin=function(){login();if(activeOwner())activate().catch(fail);};
    const logout=root.doLogout;root.doLogout=function(){logout();if(!activeOwner()){owner='';claim=null;dirty=false;$('expense-fields').replaceChildren();$('expense-saved').replaceChildren();panel.hidden=true;}};
    root.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    if($('sectionSelect').value==='expenses')root.switchSection('expenses');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof window==='undefined'?globalThis:window);
