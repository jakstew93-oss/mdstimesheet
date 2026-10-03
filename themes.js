/* Theme playground: appearance only; independent of timesheet data. */
(function () {
  const key = 'mds_theme_preference';
  const themes = { classic: 'Classic', midnight: 'Midnight Blue', graphite: 'Graphite', light: 'Light', arcade: '8-bit Arcade' };
  const colors = {classic:'#0a0a0a',midnight:'#0b1220',graphite:'#17191d',light:'#f3f6f9',arcade:'#120d26'};
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
