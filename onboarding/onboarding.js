// EyeTime OS — Onboarding Wizard Controller

(function () {
  let currentStep = 1;
  const totalSteps = 6;

  function updateStepsUI() {
    // Hide all step panels
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    // Show current step panel
    const currentPanel = document.getElementById(`step${currentStep}`);
    if (currentPanel) currentPanel.classList.add('active');

    // Update dots
    document.querySelectorAll('.step-dot').forEach(dot => {
      const stepNum = parseInt(dot.getAttribute('data-step'), 10);
      if (stepNum === currentStep) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // Navigation handlers
  document.getElementById('btnStep1Next')?.addEventListener('click', () => {
    currentStep = 2;
    updateStepsUI();
  });

  document.getElementById('btnStep2Prev')?.addEventListener('click', () => {
    currentStep = 1;
    updateStepsUI();
  });

  document.getElementById('btnStep2Next')?.addEventListener('click', () => {
    currentStep = 3;
    updateStepsUI();
  });

  document.getElementById('btnStep3Prev')?.addEventListener('click', () => {
    currentStep = 2;
    updateStepsUI();
  });

  document.getElementById('btnStep3Next')?.addEventListener('click', () => {
    currentStep = 4;
    updateStepsUI();
  });

  document.getElementById('btnStep4Prev')?.addEventListener('click', () => {
    currentStep = 3;
    updateStepsUI();
  });

  document.getElementById('btnStep4Next')?.addEventListener('click', () => {
    currentStep = 5;
    updateStepsUI();
  });

  document.getElementById('btnStep5Prev')?.addEventListener('click', () => {
    currentStep = 4;
    updateStepsUI();
  });

  document.getElementById('btnStep5Next')?.addEventListener('click', () => {
    currentStep = 6;
    updateStepsUI();
  });

  document.getElementById('btnStep6Prev')?.addEventListener('click', () => {
    currentStep = 5;
    updateStepsUI();
  });

  // Step 6: layout picker (presets come from newtab/board-presets.js)
  const WIDGET_ICONS = { focus: '⏱️', leaks: '🚰', habits: '✅', tasks: '☑️', thoughts: '🧠', goals: '🎯', chart: '📈', clock: '🕒', todaystats: '📊', eyebreak: '👁️', rules: '📜', quicklinks: '🔗', notes: '📝', search: '🔍', countdown: '⏳', pomodoro: '🍅', checklist: '🗒️', quote: '💭', calendar: '📅', progress: '📆', water: '💧', breathing: '🌬️', worldclocks: '🌍', counter: '🔢', motto: '🔥', stopwatch: '⏲️', topsites: '⭐', bookmarks: '🔖', weather: '🌤️' };
  const PV_HEIGHT = { focus: 2, leaks: 2, habits: 2, tasks: 4, thoughts: 2, goals: 2, chart: 3, pomodoro: 4, calendar: 4, search: 1, motto: 2, quote: 2, breathing: 4 };
  let chosenPreset = 'classic';
  const presets = window.EyeTimePresets || [];
  const picker = document.getElementById('layoutPicker');
  if (picker) {
    presets.forEach(p => {
      const pv = document.createElement('span');
      pv.className = 'layout-pv';
      pv.style.setProperty('--pv', (p.theme && p.theme.accent) || '#FF5E0E');
      p.widgets.forEach(([type, w]) => {
        const cell = document.createElement('i');
        cell.style.gridColumn = `span ${w}`;
        cell.style.gridRow = `span ${PV_HEIGHT[type] || 2}`;
        cell.textContent = WIDGET_ICONS[type] || '';
        pv.appendChild(cell);
      });
      const name = document.createElement('strong');
      const icon = document.createElement('span'); icon.textContent = p.icon;
      const label = document.createElement('span'); label.textContent = p.name;
      name.append(icon, ' ', label);
      const desc = document.createElement('small'); desc.textContent = p.desc;
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'layout-card' + (p.id === chosenPreset ? ' on' : '');
      card.setAttribute('role', 'radio'); card.setAttribute('aria-checked', p.id === chosenPreset ? 'true' : 'false');
      card.append(pv, name, desc);
      card.addEventListener('click', () => {
        chosenPreset = p.id;
        picker.querySelectorAll('.layout-card').forEach(c => { c.classList.remove('on'); c.setAttribute('aria-checked', 'false'); });
        card.classList.add('on'); card.setAttribute('aria-checked', 'true');
      });
      picker.appendChild(card);
    });
  }

  // Turn a preset into the saved new-tab layout (same format the board uses)
  function layoutFromPreset(p) {
    const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const builtin = ['focus', 'leaks', 'habits', 'tasks', 'thoughts', 'goals', 'chart'];
    return {
      v: 2,
      theme: Object.assign({}, p.theme || {}),
      widgets: p.widgets.map(([type, w, cfg, style]) => ({ id: builtin.includes(type) ? type : uid(), type, w, cfg: cfg || {}, style: style || {} }))
    };
  }

  // Test Tibetan singing bowl gong
  document.getElementById('btnTestGong')?.addEventListener('click', () => {
    if (window.EyeTimeAudio) {
      window.EyeTimeAudio.playFocusGong();
    }
  });

  // Complete Onboarding & Save
  document.getElementById('btnCompleteOnboarding')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnCompleteOnboarding');
    btn.disabled = true;
    btn.textContent = 'Сохранение настроек...';

    const bedtime = document.getElementById('inputBedtime')?.value || '23:00';
    const workHours = document.getElementById('checkWorkHours')?.checked === true;
    const antiShorts = document.getElementById('checkAntiShorts')?.checked !== false;
    const focusUrl = document.getElementById('inputFocusUrl')?.value?.trim() || '';

    // Collect custom goals / counters
    const goalRows = document.querySelectorAll('.goal-input-row');
    const counters = [];
    goalRows.forEach(row => {
      const label = row.querySelector('.goal-label')?.value?.trim();
      const target = parseInt(row.querySelector('.goal-target')?.value, 10) || 1;
      if (label) {
        counters.push({ label, current: 0, target, isCounter: true });
      }
    });

    if (counters.length === 0) {
      counters.push(
        { label: 'Сессий глубокого фокуса', current: 0, target: 4, isCounter: true },
        { label: 'Важных рабочих задач', current: 0, target: 5, isCounter: true }
      );
    }

    try {
      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || {};
      settings.interceptor = settings.interceptor || {};
      settings.interceptor.bedtime = bedtime;
      settings.blocking = settings.blocking || {};
      settings.blocking.schedule = Object.assign({ start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5], strict: false, passMinutes: 5 }, settings.blocking.schedule, { enabled: workHours });
      settings.interceptor.uncomfortableCounters = counters;
      settings.interceptor.focusUrl = focusUrl;

      settings.antiDoomscroll = settings.antiDoomscroll || {};
      settings.antiDoomscroll.enabled = antiShorts;

      const preset = (window.EyeTimePresets || []).find(p => p.id === chosenPreset);
      const extra = {};
      if (preset) { extra.newtabLayout = layoutFromPreset(preset); extra.newtabWelcomed = true; }
      await chrome.storage.local.set(Object.assign({
        settings,
        eyetime_onboarded: true
      }, extra));

      // Play victory chime upon onboarding completion
      if (window.EyeTimeAudio) {
        window.EyeTimeAudio.playCompletionChime();
      }

      // Redirect directly to the personalized New Tab Cockpit!
      setTimeout(() => {
        window.location.href = chrome.runtime.getURL('newtab/newtab.html');
      }, 700);
    } catch (e) {
      window.location.href = chrome.runtime.getURL('newtab/newtab.html');
    }
  });

  updateStepsUI();
})();

// Pre-filled goal names are Russian in the markup: show them in the selected language
(function translateGoalDefaults() {
  const run = () => document.querySelectorAll('.goal-label').forEach(i => { if (window.EyeTimeI18n) i.value = window.EyeTimeI18n.t(i.value); });
  if (window.EyeTimeI18n && window.EyeTimeI18n.ready) window.EyeTimeI18n.ready.then(run); else run();
  run();
})();
