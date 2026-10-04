(function (root) {
  'use strict';
  const fields = ['startTime', 'timeOnSite', 'timeOffSite', 'endTime'];
  function normalise(value) {
    if (!value || value.version !== 1 || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) ||
        !Array.isArray(value.times) || value.times.length < 1 || value.times.length > 4) throw new Error('Invalid recorded times.');
    let previous = 0;
    const times = value.times.map(t => {
      if (!Number.isSafeInteger(t.epochMillis) || t.epochMillis < 946684800000 || t.epochMillis > 4102444800000 ||
          !Number.isInteger(t.offsetSeconds) || Math.abs(t.offsetSeconds) > 64800 || t.epochMillis < previous) {
        throw new Error('The recorded times are invalid or out of order.');
      }
      previous = t.epochMillis;
      return {epochMillis:t.epochMillis, offsetSeconds:t.offsetSeconds};
    });
    const local = times.map(t => new Date(t.epochMillis + t.offsetSeconds * 1000).toISOString());
    const draft = {date:local[0].slice(0,10)};
    local.forEach((iso,i) => { draft[fields[i]] = iso.slice(11,16); });
    draft._widget = {id:value.id, times};
    return {draft, local};
  }
  function parseRecordedText(text) {
    let raw = String(text).trim();
    if (raw.length > 6000) throw new Error('Recorded times are too large.');
    if (raw.startsWith('MDS-WIDGET:')) raw = raw.slice('MDS-WIDGET:'.length);
    else if (raw.startsWith('https://')) {
      const url = new URL(raw);
      if (url.origin !== 'https://jakstew93-oss.github.io' || !url.pathname.startsWith('/mdstimesheet/') || !url.hash.startsWith('#mds-widget=')) throw new Error('This is not an MDS recorded-times link.');
      raw = decodeURIComponent(url.hash.slice('#mds-widget='.length));
    }
    return normalise(JSON.parse(raw));
  }
  if (typeof module !== 'undefined'  && module.exports) { module.exports = {normalise, parseRecordedText}; return; }
  const pendingKey = 'mds_widget_pending_v1';
  let pending = null;
  function acceptLink() {
    if (!location.hash.startsWith('#mds-widget=')) return;
    try {
      if (location.hash.length > 6000) throw new Error('Recorded times link is too large.');
      pending = normalise(JSON.parse(decodeURIComponent(location.hash.slice('#mds-widget='.length))));
      sessionStorage.setItem(pendingKey,JSON.stringify(pending.draft._widget));
    } catch (error) { pending = {error:error.message}; }
    history.replaceState(null,'',location.pathname+location.search);
    maybeOpen();
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey)||'null');
    if(saved) pending = normalise({...saved,version:1});
  } catch (_) { sessionStorage.removeItem(pendingKey); }
  let dialog;
  function ensureDialog() {
    if (dialog) return;
    dialog=document.createElement('dialog');dialog.id='widget-import-dialog';dialog.setAttribute('aria-labelledby','widget-import-title');
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{pending=null;sessionStorage.removeItem(pendingKey)});
  }
  function maybeOpen() {
    if (!pending || !localStorage.getItem('ts_auth_user') || !document.getElementById('loginScreen')?.classList.contains('hidden')) return;
    ensureDialog();
    dialog.replaceChildren();
    const title=document.createElement('h2');title.id='widget-import-title';title.textContent='Recorded widget times';dialog.append(title);
    const info=document.createElement('p');info.textContent=pending.error||'Add these times to '+localStorage.getItem('ts_auth_user')+'’s quick entry. Original tap timestamps are kept; the timesheet displays hours and minutes.';dialog.append(info);
    if(!pending.error){
      pending.local.forEach((iso,i)=>{const row=document.createElement('p');row.textContent=['Start','On site','Off site','Finish'][i]+' · '+iso.slice(0,10)+' · '+iso.slice(11,19);dialog.append(row)});
      const use=document.createElement('button');use.type='button';use.textContent='Use recorded times';
      const message=document.createElement('p');message.setAttribute('role','status');
      use.addEventListener('click',()=>{
        try {
          const draft=JSON.parse(localStorage.getItem('mds_qs_draft')||'{}')||{};
          const entries=typeof getEntries==='function'?getEntries():[];
          if(entries.some(e=>e.widgetCaptureId===pending.draft._widget.id)){message.textContent='These times are already saved in your timesheet.';return}
          const hasDraft=['date','jobNumber','vehicleReg','driverName',...fields,'food','hol'].some(k=>!!draft[k]);
          if(hasDraft){message.textContent='Save or reset your current quick entry first, then open these times again from MDS Quick Log.';return}
          localStorage.setItem('mds_qs_draft',JSON.stringify({...pending.draft,_savedAt:new Date().toISOString()}));
          const section=document.getElementById('sectionSelect');section.value='timesheet';section.dispatchEvent(new Event('change',{bubbles:true}));
          document.querySelector('#ts-tabs .tab')?.click();
          if(typeof renderAll==='function') renderAll();
          dialog.close();
          document.querySelector('.quickstart')?.scrollIntoView({block:'start',behavior:'smooth'});
        } catch (_) { message.textContent='The times could not be loaded. Your widget copy is still on your phone.'; }
      });
      dialog.append(use,message);
    }
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Close';cancel.addEventListener('click',()=>dialog.close());dialog.append(cancel);
    if (!dialog.open) dialog.showModal();
  }
  window.addEventListener('hashchange',acceptLink);
  const login=document.getElementById('loginScreen');
  if(login)new MutationObserver(maybeOpen).observe(login,{attributes:true,attributeFilter:['class']});
  acceptLink();maybeOpen();
})(typeof window==='undefined'?globalThis:window);
