/* Theme playground: appearance only; independent of timesheet data. */
(function () {
  const key = 'mds_theme_preference';
  const themes = { classic: 'Classic', midnight: 'Midnight Blue', graphite: 'Graphite', light: 'Light', arcade: '8-bit Arcade' };
  const colors = {classic:'#0a0a0a',midnight:'#0b1220',graphite:'#17191d',light:'#f3f6f9',arcade:'#d9f5e5'};
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
  const login = document.getElementById('loginScreen');
  if (login) login.appendChild(loginPanel);
  apply(current);
})();
