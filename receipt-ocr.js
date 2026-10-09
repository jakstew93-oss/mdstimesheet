(function(root){
  'use strict';
  function dateValue(day,month,year){
    year=Number(year);if(year<100)year+=year<70?2000:1900;
    day=Number(day);month=Number(month);const d=new Date(Date.UTC(year,month-1,day));
    if(year<2000||year>2099||d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return '';
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function parse(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),dates=[],amounts=[];
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    lines.forEach((line,index)=>{
      for(const m of line.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)){const value=dateValue(m[3],m[2],m[1]);if(value)dates.push({value,line,index,score:/\bdate\b/i.test(line)?10:5});}
      for(const m of line.matchAll(/\b(\d{1,2})[\s/.-]+(\d{1,2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s/.,-]+(20\d{2}|\d{2})\b/gi)){const month=/\D/.test(m[2])?months.indexOf(m[2].slice(0,3).toLowerCase())+1:Number(m[2]);const value=dateValue(m[1],month,m[3]);if(value)dates.push({value,line,index,score:/\bdate\b/i.test(line)?10:5});}
      const excluded=/\b(sub\s*total|subtotal|vat|tax|saving|discount|change|cash|tendered|balance brought|refund)\b/i.test(line);
      let score=/\b(grand\s+total|total\s+(?:due|paid|amount|incl)|amount\s+(?:due|paid)|balance\s+due)\b/i.test(line)?100:/\btotal\b/i.test(line)?80:/\b(card|payment|paid)\b/i.test(line)?50:0;
      if(excluded&&!/\btotal\b.*\b(?:incl|including)\b/i.test(line))score=-50;
      const found=[...line.matchAll(/(?:£\s*|GBP\s*)?\b(\d{1,3}(?:,\d{3})+|\d+)\s*[.,]\s*(\d{2})(?!\d)/gi)];
      // A total label sometimes occupies the line immediately above its value.
      if(!score&&index>0&&/^(?:grand\s+)?total(?:\s+(?:due|paid|amount))?\s*[:£]?$/i.test(lines[index-1]))score=90;
      if(!score&&/£|\bGBP\b/i.test(line))score=20;
      found.forEach(m=>{if(/\d[/:.-]$/.test(line.slice(0,m.index))||/^\s*[/:.-]\d/.test(line.slice(m.index+m[0].length)))return;
        const amount=Number(m[1].replace(/,/g,''))+Number(m[2])/100;if(amount>0&&amount<1000000)amounts.push({value:amount.toFixed(2),line,index,score});
      });
    });
    const unique=list=>{const seen=new Set();return list.sort((a,b)=>b.score-a.score||a.index-b.index).filter(x=>!seen.has(x.value)&&seen.add(x.value));};
    const dateCandidates=unique(dates),amountCandidates=unique(amounts),best=amountCandidates[0];
    // Prefer labelled totals. Unlabelled multiple prices require the user to choose.
    const amount=best&&(best.score>=50||(amountCandidates.length===1&&best.score>=0))?best.value:'';
    return {date:dateCandidates[0]?.value||'',amount,dateCandidates,amountCandidates,text:lines.join('\n')};
  }
  const api={parse,dateValue};root.MDSReceiptOCR=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;if(!root.document)return;
  let libraryPromise;
  function library(){
    if(root.Tesseract)return Promise.resolve(root.Tesseract);
    if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();libraryPromise=null;reject(new Error('Scanner could not load. Check your internet connection and try again.'));},30000);script.src='./vendor/ocr/tesseract.min.js';script.onload=()=>{clearTimeout(timer);resolve(root.Tesseract);};script.onerror=()=>{clearTimeout(timer);libraryPromise=null;reject(new Error('Scanner could not load. Check your internet connection and try again.'));};document.head.append(script);});return libraryPromise;
  }
  async function scan(image){
    const dialog=document.createElement('dialog');dialog.className='expense-scan-dialog';dialog.innerHTML='<h2>Scanning receipt</h2><p class="expense-note">Keep this screen open. The first scan downloads the scanner data and needs an internet connection. Your photo is read on this device.</p><p data-progress role="status" aria-live="polite">Loading scanner…</p><button type="button" class="btn btn-secondary">Cancel scan</button>';document.body.append(dialog);dialog.showModal();
    let worker,cancelled=false,rejectCancel,timer;const cancelledPromise=new Promise((_,reject)=>{rejectCancel=reject;});
    const cancel=()=>{cancelled=true;const e=new Error('Receipt scan cancelled.');e.name='AbortError';rejectCancel(e);if(worker)worker.terminate().catch(()=>{});};
    dialog.querySelector('button').onclick=cancel;dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
    timer=setTimeout(()=>{cancelled=true;rejectCancel(new Error('Receipt scanning timed out. Try a clearer photo with a good connection.'));if(worker)worker.terminate().catch(()=>{});},120000);
    const work=(async()=>{
      const T=await library();if(cancelled)return;
      worker=await T.createWorker('eng',1,{workerPath:new URL('./vendor/ocr/worker.min.js',document.baseURI).href,workerBlobURL:false,corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',logger:m=>{if(!cancelled)dialog.querySelector('[data-progress]').textContent=(m.status==='recognizing text'?'Reading receipt':m.status)+' · '+Math.round((m.progress||0)*100)+'%';},errorHandler:e=>rejectCancel(new Error('Scanner failed: '+(e.message||String(e))))});
      if(cancelled){await worker.terminate();return;}
      await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
      const result=await worker.recognize(image,{}, {text:true});return parse(result.data.text);
    })();
    try{return await Promise.race([work,cancelledPromise]);}finally{cancelled=true;clearTimeout(timer);dialog.close();dialog.remove();if(worker)await worker.terminate().catch(()=>{});}
  }
  function review(result,{type='purchases',newEntry=true}={}){
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='expense-scan-dialog';dialog.innerHTML=`<form><h2>Check scanned receipt</h2><p class="expense-note">Check the receipt date and final total before adding it. You can correct either value.</p>${newEntry?`<div class="field"><label for="ocr-category">Expense type</label><select id="ocr-category">${[['purchases','Purchases'],['parking','Parking'],['other','Other Expenditures']].map(([v,t])=>`<option value="${v}" ${v===type?'selected':''}>${t}</option>`).join('')}</select></div>`:''}<div class="field"><label for="ocr-date">Receipt date${result.date?'':' — not detected'}</label><input id="ocr-date" type="date" required value="${esc(result.date)}"></div><div class="field"><label for="ocr-amount">Total amount (£)${result.amount?'':' — please choose or enter'}</label><input id="ocr-amount" type="number" min="0.01" max="999999.99" step="0.01" inputmode="decimal" required value="${esc(result.amount)}"></div>${result.amountCandidates.length>1?`<div class="field"><label for="ocr-alternatives">Other amounts read from this receipt</label><select id="ocr-alternatives"><option value="">Choose an amount if needed</option>${result.amountCandidates.map(x=>`<option value="${x.value}">£${x.value} · ${esc(x.line)}</option>`).join('')}</select></div>`:''}<details><summary>Show text read from receipt</summary><pre class="expense-ocr-text">${esc(result.text||'No readable text found. Enter the date and amount manually, or cancel and try a clearer photo.')}</pre></details><div class="expense-actions"><button type="button" class="btn btn-secondary" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${newEntry?'Add to expense log':'Use date and amount'}</button></div></form>`;
      const finish=value=>{dialog.close();dialog.remove();resolve(value);};dialog.querySelector('[data-cancel]').onclick=()=>finish(null);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});dialog.querySelector('#ocr-alternatives')?.addEventListener('change',e=>{if(e.target.value)dialog.querySelector('#ocr-amount').value=e.target.value;});dialog.querySelector('form').onsubmit=e=>{e.preventDefault();finish({type:newEntry?dialog.querySelector('#ocr-category').value:type,date:dialog.querySelector('#ocr-date').value,amount:Number(dialog.querySelector('#ocr-amount').value).toFixed(2)});};document.body.append(dialog);dialog.showModal();
    });
  }
  api.scan=scan;api.review=review;
})(typeof window==='undefined'?globalThis:window);
