// EyeTime OS — Onboarding Wizard Controller

(function () {
  let currentStep = 1;
  const totalSteps = 5;

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
    const morningWalk = document.getElementById('checkMorningWalk')?.checked !== false;
    const antiShorts = document.getElementById('checkAntiShorts')?.checked !== false;
    const focusUrl = document.getElementById('inputFocusUrl')?.value?.trim() || 'https://app.endel.io/player/focus';

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
      settings.interceptor.morningWalkRequired = morningWalk;
      settings.interceptor.uncomfortableCounters = counters;
      settings.interceptor.focusUrl = focusUrl;

      settings.antiDoomscroll = settings.antiDoomscroll || {};
      settings.antiDoomscroll.enabled = antiShorts;

      await chrome.storage.local.set({
        settings,
        eyetime_onboarded: true
      });

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
