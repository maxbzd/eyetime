// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import { bootPage } from '../ui/page.js';
import { $ } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t } from '../shared/i18n.js';
import { showQuote } from '../ui/quote.js';
import { getDays } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { isMoveBreak, exerciseOf, MOVE_SECONDS } from '../shared/moves.js';

// `?auto=1`: the worker opened this page over the whole screen because the time was up (nobody asked for it). Then it must be easy to put off and must leave by itself:
// Esc is "in five minutes", the buttons wake up after a moment (a click or a key that was on its way to the page underneath does not answer for the person),
// the window closes a few seconds after the break is done, and one quiet link leads to the setting that switches this off.
const PARAMS = new URLSearchParams(location.search);
const AUTO = PARAMS.has('auto');
const ARM_MS = 700, LEAVE_MS = 2600;

(async function main() {
  const s = await bootPage();
  showQuote($('#quote'), 'rest', s);
  const born = Date.now();
  const armed = () => !AUTO || Date.now() - born >= ARM_MS;
  // every third break is for the body: a little longer, an exercise instead of "look far away" (shared/moves.js); `?move` shows it (the settings' "show a break" and the screens)
  let taken = 0; try { const [[, day]] = await getDays([dayKey()]); taken = (day && day.b) || 0; } catch { /* no storage: an ordinary break */ }
  const move = PARAMS.has('move') || isMoveBreak(taken, s.eye.moveEvery);
  const total = move ? MOVE_SECONDS : s.eye.breakSeconds || 20;
  if (move) $('.eyebrow').textContent = t('break.moveEyebrow');
  const C = 565.5;
  let left = total, finished = false;
  const bar = $('#bar');
  const paint = () => {
    $('#count').textContent = String(left);
    bar.style.strokeDashoffset = String(C * (1 - left / total));
    if (!finished) {
      if (move) { $('#title').textContent = t('break.move'); $('#lead').textContent = t('break.ex.' + exerciseOf(taken, s.eye.moveEvery || 3)); return; }
      const blink = left <= Math.min(6, Math.floor(total / 4));
      $('#title').textContent = blink ? t('break.blink') : t('break.look');
      $('#lead').textContent = blink ? t('break.blinkLead') : t('break.lookLead');
    }
  };
  paint();
  const id = setInterval(async () => {
    left--; paint();
    if (left > 0) return;
    clearInterval(id); finished = true;
    $('.stage').classList.add('finished');
    $('#count').textContent = '✓';
    $('#title').textContent = t('break.well'); $('#lead').textContent = t(move ? 'break.moveWellLead' : 'break.wellLead');
    $('#skip').hidden = true; $('#snooze').hidden = true; $('#done').hidden = false;
    await send('break:complete');
    if (AUTO) setTimeout(() => window.close(), LEAVE_MS);
  }, 1000);
  const later = async () => { if (finished) { window.close(); return; } clearInterval(id); await send('break:snooze'); window.close(); };
  $('#skip').addEventListener('click', async () => { if (!armed()) return; clearInterval(id); await send('break:skip'); window.close(); });
  $('#snooze').addEventListener('click', () => { if (armed()) later(); });
  $('#done').addEventListener('click', () => window.close());
  if (AUTO) {
    document.body.classList.add('auto');
    const hint = $('#auto'); hint.hidden = false;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && armed()) { e.preventDefault(); later(); } });
    $('#prefs').addEventListener('click', async (e) => {
      e.preventDefault(); if (!armed()) return;
      if (!finished) { clearInterval(id); await send('break:snooze'); }
      try { await chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html#eye') }); } catch { /* no window to open it in: the break is put off all the same */ }
      window.close();
    });
  }
})();
