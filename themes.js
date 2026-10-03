/* Theme playground: appearance only; independent of timesheet data. */
(function () {
  const key = 'mds_theme_preference';
  const themes = { classic: 'Classic', midnight: 'Midnight Blue', graphite: 'Graphite', light: 'Light', arcade: '8-bit Arcade', timequest: 'TimeQuest 1985' };
  const colors = {classic:'#0a0a0a',midnight:'#0b1220',graphite:'#17191d',light:'#f3f6f9',arcade:'#120d26',timequest:'#030805'};
  let current = 'classic';
  try { const saved = localStorage.getItem(key); if (themes[saved]) current = saved; } catch (_) {}
  function apply(theme) {
    current = themes[theme] ? theme : 'classic';
    document.documentElement.dataset.mdsTheme = current;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.content = colors[current]);
    document.querySelectorAll('.theme-choice').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.theme === current)));
  }
  apply(current);
  const panel = document.createElement('details');
  panel.className = 'theme-picker';
  panel.innerHTML = '<summary>Appearance <span>Try a theme</span></summary><div class="theme-picker-body"><p>Choose your look. Saved on this device.</p><div class="theme-choices"></div><div class="theme-save-status" role="status"></div></div>';
  Object.entries(themes).forEach(([id, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'theme-choice'; btn.dataset.theme = id;
    btn.innerHTML = '<span class="theme-swatch"></span><span>' + label + '</span>';
    btn.addEventListener('click', () => {
      apply(id);
      try { localStorage.setItem(key, id); panel.querySelector('[role="status"]').textContent = ''; }
      catch (_) { panel.querySelector('[role="status"]').textContent = 'Theme applied. This browser cannot save your choice.'; }
    });
    panel.querySelector('.theme-choices').appendChild(btn);
  });
  const loginPanel = panel.cloneNode(true);
  // Use the same real controls in both places so login and app preferences stay in sync.
  loginPanel.querySelectorAll('.theme-choice').forEach(btn => btn.addEventListener('click', () => {
    apply(btn.dataset.theme);
    try { localStorage.setItem(key, current); loginPanel.querySelector('[role="status"]').textContent = ''; }
    catch (_) { loginPanel.querySelector('[role="status"]').textContent = 'Theme applied. This browser cannot save your choice.'; }
  }));
  const header = document.querySelector('header');
  if (header) header.insertAdjacentElement('afterend', panel);
  const cabinet = document.createElement('div');
  cabinet.className = 'arcade-cabinet';
  cabinet.setAttribute('aria-hidden', 'true');
  cabinet.innerHTML = '<div class="arcade-marquee"><span>1UP</span><span>MDS TIME QUEST</span><span>1985</span></div>' +
    '<div class="arcade-scene"><svg class="arcade-sprite" viewBox="0 0 16 16" role="presentation"><path fill="#59f6ff" d="M3 2h2v2H3zM11 2h2v2h-2zM5 4h6v2H5zM3 6h10v2H3zM1 8h14v4H1zM3 12h2v2H3zM11 12h2v2h-2zM5 14h2v2H5zM9 14h2v2H9z"/><path fill="#120d26" d="M4 8h2v2H4zM10 8h2v2h-2z"/></svg>' +
    '<div class="arcade-scene-copy"><strong>LEVEL 01: THE WORKDAY</strong><span>LOG TIME. SAVE PROGRESS.</span></div>' +
    '<svg class="arcade-tape" viewBox="0 0 32 22" role="presentation"><path fill="#ff73ce" d="M2 0h28v2h2v18h-2v2H2v-2H0V2h2z"/><path fill="#201536" d="M3 3h26v13H3zM8 18h16v2H8z"/><path fill="#ffe17b" d="M5 5h22v3H5zM6 10h4v4H6zM22 10h4v4h-4zM10 11h12v2H10z"/></svg></div>' +
    '<div class="arcade-footer"><span>BE KIND, REWIND</span><span>HIGH SCORE: HOME TIME</span></div>';
  if (header) panel.insertAdjacentElement('afterend', cabinet);
  const login = document.getElementById('loginScreen');
  if (login) login.appendChild(loginPanel);
  apply(current);
})();

/* TimeQuest decoration observes UI state only; it never writes timesheet data. */
(function () {
  const root = document.documentElement;
  const art = {"robot":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M6%202h12v2h2v12h-3v4H7v-4H4V4h2z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M6%207h5v4H6zM13%207h5v4h-5zM10%2012h4v3h-4zM8%2017h2v3H8zM11%2017h2v3h-2zM14%2017h2v3h-2z%22%2F%3E%3Cpath%20fill%3D%22%23e96968%22%20d%3D%22M7%208h3v2H7z%22%2F%3E%3C%2Fsvg%3E","car":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2391c89b%22%20d%3D%22M8%205h13l6%207h3v5H2v-5h3z%22%2F%3E%3Cpath%20fill%3D%22%2306130a%22%20d%3D%22M10%207h5v5H7zM17%207h3l4%205h-7zM6%2015h5v5H6zM22%2015h5v5h-5z%22%2F%3E%3Cpath%20fill%3D%22%2385ff9b%22%20d%3D%22M2%2012h3v2H2zM27%2012h3v2h-3zM13%2014h7v1h-7z%22%2F%3E%3C%2Fsvg%3E","flux":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%23426b4b%22%20d%3D%22M1%201h22v22H1z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M3%203h18v18H3z%22%2F%3E%3Cpath%20fill%3D%22%2385ff9b%22%20d%3D%22M5%204h3v5h3v3h2V9h3V4h3v7h-3v3h-3v6h-3v-6H7v-3H5z%22%2F%3E%3Cpath%20fill%3D%22%23d6ffd9%22%20d%3D%22M10%2011h4v4h-4z%22%2F%3E%3C%2Fsvg%3E","ghost":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%23bdeac5%22%20d%3D%22M8%203h8v2h3v3h2v13h-3v-3h-3v3h-3v-3H9v3H6v-3H3V8h2V5h3z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M7%208h3v4H7zM14%208h3v4h-3zM10%2014h4v3h-4z%22%2F%3E%3C%2Fsvg%3E","disk":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M3%202h16l3%203v17H3z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M6%202h11v7H6zM7%2013h11v9H7z%22%2F%3E%3Cpath%20fill%3D%22%23bdeac5%22%20d%3D%22M13%203h3v4h-3zM9%2015h7v1H9zM9%2018h7v1H9z%22%2F%3E%3C%2Fsvg%3E","tape":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M2%204h20v16H2z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M4%206h16v9H4zM6%2017h12v2H6z%22%2F%3E%3Cpath%20fill%3D%22%23bdeac5%22%20d%3D%22M5%207h14v3H5zM5%2011h4v3H5zM15%2011h4v3h-4zM9%2012h6v1H9z%22%2F%3E%3C%2Fsvg%3E","crt":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M1%202h22v16H1zM10%2018h4v3h5v2H5v-2h5z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M3%204h18v11H3z%22%2F%3E%3Cpath%20fill%3D%22%2385ff9b%22%20d%3D%22M5%206h2v2H5zM7%208h2v2H7zM5%2010h2v2H5zM11%2011h6v1h-6z%22%2F%3E%3C%2Fsvg%3E","ship":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M11%201h2v4h2v5h3v3h3v7h-7v-4h-4v4H3v-7h3v-3h3V5h2z%22%2F%3E%3Cpath%20fill%3D%22%23d6ffd9%22%20d%3D%22M11%207h2v5h-2z%22%2F%3E%3Cpath%20fill%3D%22%2385ff9b%22%20d%3D%22M5%2021h3v2H5zM16%2021h3v2h-3z%22%2F%3E%3C%2Fsvg%3E","reticle":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M2%202h6v2H4v4H2zM16%202h6v6h-2V4h-4zM2%2016h2v4h4v2H2zM20%2016h2v6h-6v-2h4zM11%205h2v5h-2zM11%2014h2v5h-2zM5%2011h5v2H5zM14%2011h5v2h-5z%22%2F%3E%3Cpath%20fill%3D%22%23e96968%22%20d%3D%22M11%2011h2v2h-2z%22%2F%3E%3C%2Fsvg%3E","bolt":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%23a7ffaf%22%20d%3D%22M12%201h7l-6%208h6L6%2023l4-11H5z%22%2F%3E%3C%2Fsvg%3E","joystick":"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%2378df84%22%20d%3D%22M9%202h6v6h-2v8h-2V8H9zM4%2015h16v7H4z%22%2F%3E%3Cpath%20fill%3D%22%2307140b%22%20d%3D%22M6%2018h6v2H6z%22%2F%3E%3Cpath%20fill%3D%22%23e96968%22%20d%3D%22M16%2017h2v2h-2z%22%2F%3E%3C%2Fsvg%3E"};
  const icon = (name, cls='') => '<img class="tq-icon '+cls+'" src="'+art[name]+'" alt="" aria-hidden="true">';
  document.querySelectorAll('.theme-picker-body').forEach(host => {
    const hud = document.createElement('div');
    hud.className = 'tq-hud'; hud.setAttribute('aria-hidden','true');
    hud.innerHTML =
      '<div class="tq-hud-top">'+icon('crt')+'<span>TIMEQUEST 1985<br><small>CLOCK IN. POWER UP. SURVIVE THE SHIFT.</small></span><i class="tq-led"></i></div>'+
      '<div class="tq-hud-grid"><div class="tq-hud-cell">'+icon('robot')+'<span>SYSTEM ONLINE<br><small>CYBERNETIC INTERFACE</small></span></div>'+
      '<div class="tq-hud-cell">'+icon('car')+'<span>88 MPH<br><small>TEMPORAL DATA</small></span></div>'+
      '<div class="tq-hud-cell"><i class="tq-radar"></i><span>MOTION TRACKER<br><small>DEEP SPACE TERMINAL</small></span></div>'+
      '<div class="tq-hud-cell">'+icon('reticle')+'<span>TARGET ACQUIRED<br><small>OPTICAL HUD</small></span></div></div>'+
      '<div class="tq-scanner-row"><span>SCANNING...</span><i class="tq-scanner"><b></b></i></div>'+
      '<div class="tq-diag"><span>SYS 1985 // CHRONO LINK OK // FLUX CORE STABLE // CONTAINMENT SECURE // END OF LINE</span></div>'+
      '<div class="tq-hud-footer">'+icon('flux')+icon('ghost')+icon('tape')+icon('disk')+icon('joystick')+icon('ship')+'<span>GREEN SCREEN / VHS / SIDE A</span></div>';
    host.appendChild(hud);
  });
  const crt = document.createElement('div'); crt.className='timequest-crt'; crt.setAttribute('aria-hidden','true'); document.body.appendChild(crt);
  const notice = document.createElement('div'); notice.className='tq-notice'; notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite'); document.body.appendChild(notice);
  const car = document.createElement('div'); car.className='tq-road'; car.setAttribute('aria-hidden','true'); car.innerHTML=icon('car')+icon('bolt','tq-road-flash'); document.body.appendChild(car);
  let timer, carTimer, cooldown = 0;
  const active = () => root.dataset.mdsTheme === 'timequest';
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function message(text) {
    if (!active()) return;
    clearTimeout(timer); notice.textContent=text; notice.classList.add('visible');
    timer=setTimeout(()=>{ notice.classList.remove('visible'); notice.textContent=''; },3200);
  }
  function drive() {
    if (!active() || reduced()) return;
    clearTimeout(carTimer); car.classList.remove('driving');
    // Restart a short, one-off sprite pass. No periodic animation or game loop.
    void car.offsetWidth; car.classList.add('driving');
    carTimer=setTimeout(()=>car.classList.remove('driving'),2600);
  }
  document.addEventListener('input', event => {
    if (!active() || !['qsJob','jobNumber'].includes(event.target.id)) return;
    if (String(event.target.value).trim() === '88' && Date.now() >= cooldown) {
      cooldown=Date.now()+60000; message('TEMPORAL DISPLACEMENT DETECTED'); drive();
    }
  });
  const toast = document.getElementById('toast');
  if (toast) {
    const observer=new MutationObserver(()=>{
      if (!active()) { delete toast.dataset.tqStatus; return; }
      const text=toast.textContent.trim();
      toast.dataset.tqStatus=/^Error:/i.test(text) ? 'error' : /^(Entry (added|updated)|Check sheet (saved|updated))/i.test(text) ? 'saved' : 'message';
    });
    observer.observe(toast,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  function changed() {
    if (!active()) { clearTimeout(timer); clearTimeout(carTimer); notice.classList.remove('visible'); notice.textContent=''; car.classList.remove('driving'); }
    else if (Math.random()<0.08) { message(Math.random()<0.5 ? "I'LL BE BACK..." : 'GREAT SCOTT!'); drive(); }
  }
  new MutationObserver(changed).observe(root,{attributes:true,attributeFilter:['data-mds-theme']});
})();
