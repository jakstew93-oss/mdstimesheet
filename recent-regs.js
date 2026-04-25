(function () {
  const STORAGE_KEY = 'mds_recent_vehicle_regs';
  const MAX_REGS = 8;

  function normaliseReg(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function readStoredRegs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normaliseReg).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function writeStoredRegs(regs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(regs.slice(0, MAX_REGS)));
  }

  function rememberReg(value) {
    const reg = normaliseReg(value);
    if (!reg) return;
    const regs = [reg].concat(readStoredRegs().filter(item => item !== reg));
    writeStoredRegs(regs);
  }

  function entryRegs() {
    if (typeof window.getEntries !== 'function') return [];
    try {
      return window.getEntries()
        .slice()
        .reverse()
        .map(entry => normaliseReg(entry && entry.vehicleReg))
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function getRecentRegs() {
    const seen = new Set();
    const regs = [];
    entryRegs().concat(readStoredRegs()).forEach(reg => {
      if (seen.has(reg)) return;
      seen.add(reg);
      regs.push(reg);
    });
    return regs.slice(0, MAX_REGS);
  }

  function ensureStyles() {
    if (document.getElementById('recent-regs-enhancement-style')) return;
    const style = document.createElement('style');
    style.id = 'recent-regs-enhancement-style';
    style.textContent = `
      .quick-reg-memory {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        min-height: 0;
      }
      .recent-regs-title {
        flex: 0 0 100%;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .04em;
        text-transform: uppercase;
        opacity: .68;
      }
      .recent-reg-btn {
        appearance: none;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 7px;
        background: rgba(255,255,255,.08);
        color: inherit;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        min-height: 34px;
        padding: 7px 10px;
      }
      .recent-reg-btn.selected {
        border-color: #00c853;
        box-shadow: 0 0 0 1px rgba(0,200,83,.22) inset;
      }
    `;
    document.head.appendChild(style);
  }

  function syncInput(reg) {
    const input = document.getElementById('qsReg') || document.getElementById('vehicleReg');
    if (!input) return;
    input.value = reg;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    rememberReg(reg);
    renderRecentRegs();
  }

  function ensureContainer() {
    const input = document.getElementById('qsReg') || document.getElementById('vehicleReg');
    if (!input) return null;

    let container = document.getElementById('quickRegMemory');
    if (!container) {
      container = document.createElement('div');
      container.id = 'quickRegMemory';
      const existing = document.getElementById('recentRegsContainer');
      (existing || input).insertAdjacentElement('afterend', container);
    }
    container.classList.add('quick-reg-memory');
    return container;
  }

  function renderRecentRegs() {
    ensureStyles();
    const container = ensureContainer();
    if (!container) return;

    const regs = getRecentRegs();
    const input = document.getElementById('qsReg') || document.getElementById('vehicleReg');
    const current = normaliseReg(input && input.value);
    const signature = regs.join('|') + '::' + current;
    if (container.dataset.renderedSignature === signature) return;
    container.dataset.renderedSignature = signature;
    container.replaceChildren();

    if (!regs.length) return;

    const title = document.createElement('div');
    title.className = 'recent-regs-title';
    title.textContent = 'Recent regs';
    container.appendChild(title);

    regs.forEach(reg => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-reg-btn' + (reg === current ? ' selected' : '');
      button.textContent = reg;
      button.addEventListener('click', () => syncInput(reg));
      container.appendChild(button);
    });
  }

  function hookVehicleRegInput() {
    const input = document.getElementById('qsReg') || document.getElementById('vehicleReg');
    if (!input || input.dataset.recentRegsHooked === 'true') return;
    input.dataset.recentRegsHooked = 'true';
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase();
      if (normaliseReg(input.value).length >= 3) rememberReg(input.value);
      renderRecentRegs();
    });
    input.addEventListener('blur', () => {
      rememberReg(input.value);
      renderRecentRegs();
    });
  }

  function bootRecentRegs() {
    hookVehicleRegInput();
    renderRecentRegs();
  }

  const observer = new MutationObserver(bootRecentRegs);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', bootRecentRegs);
  window.addEventListener('storage', bootRecentRegs);
  setInterval(bootRecentRegs, 1500);
  bootRecentRegs();
})();
