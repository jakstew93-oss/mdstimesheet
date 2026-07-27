(function () {
  const STORAGE_KEY = 'mds_recent_vehicle_regs';
  const HOLIDAY_STORAGE_KEY = 'mds_holiday_forms_sent';
  const HOLIDAY_USED_ADJUSTMENT_STORAGE_KEY = 'mds_holiday_used_adjustment_days';
  const HOLIDAY_ALLOWANCE_DAYS = 21;
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
      .holiday-allowance-card {
        border: 1px solid rgba(0,200,83,.34);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(0,200,83,.14), rgba(255,255,255,.04));
        padding: 16px;
        margin-bottom: 14px;
      }
      .holiday-allowance-title {
        color: #00c853;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .16em;
        margin-bottom: 12px;
        text-transform: uppercase;
      }
      .holiday-allowance-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
      }
      .holiday-allowance-box {
        background: rgba(0,0,0,.18);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px;
        padding: 12px;
      }
      .holiday-allowance-label {
        color: var(--subtext, rgba(255,255,255,.58));
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .12em;
        margin-bottom: 7px;
        text-transform: uppercase;
      }
      .holiday-allowance-value {
        color: var(--text, #fff);
        font-size: 30px;
        font-weight: 900;
        line-height: 1;
      }
      .holiday-allowance-value span {
        color: var(--subtext, rgba(255,255,255,.58));
        font-size: 13px;
        font-weight: 800;
      }
      .holiday-allowance-actions {
        align-items: center;
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .holiday-allowance-edit {
        appearance: none;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 8px;
        color: var(--text, #fff);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        min-height: 34px;
        padding: 7px 11px;
      }
      .holiday-allowance-input {
        appearance: textfield;
        background: rgba(0,0,0,.18);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        color: var(--text, #fff);
        font: inherit;
        font-size: 30px;
        font-weight: 900;
        line-height: 1;
        max-width: 110px;
        min-height: 34px;
        padding: 5px 8px;
        width: 110px;
      }
      .holiday-allowance-input::-webkit-outer-spin-button,
      .holiday-allowance-input::-webkit-inner-spin-button {
        appearance: none;
        margin: 0;
      }
      .holiday-allowance-note {
        color: var(--subtext, rgba(255,255,255,.58));
        font-size: 12px;
        line-height: 1.35;
        margin-top: 10px;
      }
      @media (max-width: 360px) {
        .holiday-allowance-grid {
          grid-template-columns: 1fr;
        }
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
    if (input.id === 'qsReg') {
      try {
        const draft = JSON.parse(localStorage.getItem('mds_qs_draft') || '{}') || {};
        if (reg) {
          draft.vehicleReg = reg;
          draft._savedAt = new Date().toISOString();
          localStorage.setItem('mds_qs_draft', JSON.stringify(draft));
          const status = document.getElementById('qsDraftStatus');
          if (status) {
            status.classList.add('has-draft');
            status.innerHTML = '<span>Draft saved · ' + reg + '</span>';
          }
        }
      } catch (_) {}
    }
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

  function readHolidayForms() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HOLIDAY_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(item => ({
          id: String(item.id || ''),
          signature: String(item.signature || ''),
          days: Number(item.days || 0),
          date: String(item.date || ''),
          from: String(item.from || ''),
          to: String(item.to || ''),
          name: String(item.name || '')
        }))
        .filter(item => item.id && item.days > 0);
    } catch (_) {
      return [];
    }
  }

  function writeHolidayForms(forms) {
    localStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify(forms));
  }

  function getLoggedHolidayDays() {
    return readHolidayForms().reduce((total, form) => total + form.days, 0);
  }

  function readHolidayUsedAdjustment() {
    const stored = Number(localStorage.getItem(HOLIDAY_USED_ADJUSTMENT_STORAGE_KEY));
    return Number.isFinite(stored) ? stored : 0;
  }

  function getHolidayUsedDays() {
    return Math.max(0, getLoggedHolidayDays() + readHolidayUsedAdjustment());
  }

  function writeHolidayUsedDays(days) {
    const parsed = Number(days);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const adjustment = Math.round((parsed - getLoggedHolidayDays()) * 10) / 10;
    localStorage.setItem(HOLIDAY_USED_ADJUSTMENT_STORAGE_KEY, String(adjustment));
  }

  function formatHolidayDays(days) {
    return String(Math.round(Number(days || 0) * 10) / 10).replace(/\.0$/, '');
  }

  function getHolidayFormDays() {
    const value = (document.getElementById('holidayDays')?.value || '').match(/\d+(?:\.\d+)?/);
    return value ? Number(value[0]) : 0;
  }

  function getHolidayFormSignature() {
    const name = (document.getElementById('holidayName')?.value || '').trim();
    const from = document.getElementById('holidayFrom')?.value || '';
    const to = document.getElementById('holidayTo')?.value || '';
    const days = getHolidayFormDays();
    return { name, from, to, days, signature: [name, from, to, days].join('|') };
  }

  function showNotice(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function logCurrentHolidayForm(options = {}) {
    const silent = options && options.silent === true;
    const current = getHolidayFormSignature();
    if (!Number.isFinite(current.days) || current.days <= 0) {
      if (!silent) showNotice('Pick holiday dates first');
      return false;
    }

    const forms = readHolidayForms();
    if (forms.some(form => form.signature === current.signature)) {
      if (!silent) showNotice('Holiday form already deducted');
      renderHolidayAllowance();
      return false;
    }

    forms.push({
      id: String(Date.now()),
      signature: current.signature,
      days: current.days,
      date: new Date().toISOString().slice(0, 10),
      from: current.from,
      to: current.to,
      name: current.name
    });
    writeHolidayForms(forms);
    renderHolidayAllowance();
    if (!silent) showNotice('Holiday allowance updated');
    return true;
  }

  function renderHolidayAllowance() {
    ensureStyles();
    const holidayCard = document.querySelector('#section-holiday .holiday-form-card');
    if (!holidayCard) return;

    let panel = document.getElementById('holidayAllowanceCard');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'holidayAllowanceCard';
      panel.className = 'holiday-allowance-card';
      holidayCard.insertAdjacentElement('afterbegin', panel);
    }
    if (
      panel.dataset.editingUsedDays === 'true' &&
      document.activeElement &&
      document.activeElement.id === 'holidayUsedInput'
    ) {
      return;
    }

    const used = getHolidayUsedDays();
    const allowance = HOLIDAY_ALLOWANCE_DAYS;
    const remaining = Math.max(0, allowance - used);
    const currentDays = getHolidayFormDays();
    const isEditing = panel.dataset.editingUsedDays === 'true';

    panel.innerHTML =
      '<div class="holiday-allowance-title">Annual leave allowance</div>' +
      '<div class="holiday-allowance-grid">' +
        '<div class="holiday-allowance-box"><div class="holiday-allowance-label">Days left</div><div class="holiday-allowance-value">' + formatHolidayDays(remaining) + ' <span>of ' + formatHolidayDays(allowance) + '</span></div></div>' +
        '<div class="holiday-allowance-box"><div class="holiday-allowance-label">Days used</div><div class="holiday-allowance-value">' + formatHolidayDays(used) + ' <span>days</span></div></div>' +
      '</div>' +
      '<div class="holiday-allowance-actions">' +
        (isEditing
          ? '<input class="holiday-allowance-input" id="holidayUsedInput" type="number" inputmode="decimal" min="0" step="0.5" value="' + formatHolidayDays(used) + '" aria-label="Holiday days used"><button class="holiday-allowance-edit" type="button" id="holidaySaveUsedBtn">Save</button>'
          : '<button class="holiday-allowance-edit" type="button" id="holidayEditUsedBtn">Edit days used</button>') +
      '</div>' +
      '<div class="holiday-allowance-note">Weekends are excluded by the form. Generating the same form twice will not deduct twice.</div>';

    const editButton = document.getElementById('holidayEditUsedBtn');
    if (editButton) {
      editButton.onclick = () => {
        panel.dataset.editingUsedDays = 'true';
        renderHolidayAllowance();
        document.getElementById('holidayUsedInput')?.focus();
      };
    }

    const usedInput = document.getElementById('holidayUsedInput');
    const saveUsedDays = () => {
      if (usedInput) {
        writeHolidayUsedDays(usedInput.value);
        showNotice('Days used updated');
      }
      panel.dataset.editingUsedDays = 'false';
      renderHolidayAllowance();
    };
    const saveButton = document.getElementById('holidaySaveUsedBtn');
    if (saveButton) saveButton.onclick = saveUsedDays;
    if (usedInput) usedInput.onkeydown = event => {
      if (event.key === 'Enter') saveUsedDays();
    };
  }

  function hookHolidayForm() {
    const section = document.getElementById('section-holiday');
    if (!section) return;

    renderHolidayAllowance();
    ['holidayFrom', 'holidayTo', 'holidayDays', 'holidayName'].forEach(id => {
      const input = document.getElementById(id);
      if (input && input.dataset.holidayAllowanceHooked !== 'true') {
        input.dataset.holidayAllowanceHooked = 'true';
        input.addEventListener('input', () => setTimeout(renderHolidayAllowance, 0));
        input.addEventListener('change', () => setTimeout(renderHolidayAllowance, 0));
      }
    });

    const pdfButton = document.getElementById('holidayPdfBtn');
    if (pdfButton && !document.getElementById('holidayPdfDeductBtn')) {
      const deductButton = document.createElement('button');
      deductButton.className = 'btn btn-success';
      deductButton.id = 'holidayPdfDeductBtn';
      deductButton.type = 'button';
      deductButton.textContent = 'Generate & Deduct Days';
      deductButton.addEventListener('click', () => {
        pdfButton.click();
        setTimeout(() => logCurrentHolidayForm({ silent: true }), 1200);
      });
      pdfButton.insertAdjacentElement('afterend', deductButton);
    }
  }

  function bootRecentRegs() {
    try {
      hookVehicleRegInput();
      renderRecentRegs();
      hookHolidayForm();
    } catch (err) {
      console.warn('Timesheet enhancement failed:', err);
    }
  }

  const observer = new MutationObserver(bootRecentRegs);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', bootRecentRegs);
  window.addEventListener('storage', bootRecentRegs);
  setInterval(bootRecentRegs, 1500);
  bootRecentRegs();
})();
