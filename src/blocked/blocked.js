import { bootPage } from '../ui/page.js';
import { $, favicon, clear, h } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { evaluate } from '../shared/policy.js';
import { getSettings, getRaw, dayStorageKey } from '../shared/storage.js';
import { clock } from '../shared/focus.js';
import { dayKey } from '../shared/time.js';
import { usageOf } from '../shared/policy.js';

const params = new URLSearchParams(location.search);

/** Only ever navigate back to a plain http(s) URL. */
function safeTarget(raw) {
  try { const u = new URL(raw); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
const target = safeTarget(params.get('u'));
const host = target ? new URL(target).hostname.replace(/^www\./, '') : '';

let decision = null, settings = null, timers = [];

function goBack() {
  if (history.length > 1) history.back();
  else location.href = chrome.runtime.getURL('src/newtab/newtab.html');
}

function release() { if (target) location.replace(target); }

async function check() {
  if (!target) return null;
  const d = await evaluate(target);
  if (d.action === 'allow') { release(); return null; }
  return d;
}

function waitThen(btn, seconds, label, onReady) {
  let left = seconds;
  btn.disabled = true;
  const paint = () => { btn.textContent = left > 0 ? t('block.continueIn', { n: left }) : label; };
  paint();
  const id = setInterval(() => { left--; paint(); if (left <= 0) { clearInterval(id); btn.disabled = false; onReady?.(); } }, 1000);
  timers.push(id);
}

async function render() {
  timers.forEach(clearInterval); timers = [];
  if (!target) { clear($('#stage'), h('h1', { text: t('block.invalid') })); return; }
  settings = await getSettings();
  decision = await check();
  if (!decision) return;

  const reason = decision.reason;
  const back = $('#back'), cont = $('#cont'), lead = $('#lead'), title = $('#title'), note = $('#note');
  const wait = Math.max(5, settings.blocking.friction.seconds || 8);
  $('#sitePill').replaceChildren(favicon(host), h('span', { text: host }));
  back.textContent = t('block.back'); back.onclick = goBack;
  $('#breath').hidden = true; $('#bigClock').hidden = true; $('#goal').hidden = true; $('#manage').hidden = true;
  cont.hidden = true; cont.onclick = null; note.textContent = '';

  const offerContinue = (minutes) => {
    cont.hidden = false;
    const label = t('block.continueFor', { n: minutes });
    waitThen(cont, wait, label);
    cont.onclick = async () => { await send('pass:grant', { rule: decision.rule, minutes }); release(); };
    note.textContent = t('block.passNote', { n: minutes });
  };

  if (reason === 'friction') {
    document.title = t('block.pause.title') + ' — EyeTime';
    title.textContent = t('block.pause.title');
    lead.textContent = t('block.pause.lead', { host });
    $('#breath').hidden = false;
    const label = $('#breathLabel');
    const flip = () => { label.textContent = label.textContent === t('block.breatheIn') ? t('block.breatheOut') : t('block.breatheIn'); };
    label.textContent = t('block.breatheOut'); flip();
    timers.push(setInterval(flip, 4000));
    waitThen(cont, decision.seconds || wait, t('block.continue'), () => { note.textContent = t('block.passNote', { n: decision.passMinutes }); });
    cont.hidden = false;
    cont.onclick = async () => { await send('pass:grant', { rule: decision.rule, minutes: decision.passMinutes }); release(); };
    return;
  }

  if (reason === 'focus') {
    const f = decision.focus;
    title.textContent = t('block.focus.title');
    lead.textContent = t('block.focus.lead', { host });
    if (f?.goal) { $('#goal').hidden = false; $('#goal').textContent = f.goal; }
    const big = $('#bigClock'); big.hidden = false;
    const paint = () => { const left = f.endsAt - Date.now(); big.textContent = clock(Math.max(0, left)); if (left <= 0) { render(); } };
    paint(); timers.push(setInterval(paint, 1000));
    if (decision.strict) note.textContent = t('block.strictNote', { time: fmtTime(new Date(f.endsAt), settings.newtab.clock24 === null ? undefined : settings.newtab.clock24) });
    else offerContinue(decision.passMinutes);
  } else if (reason === 'schedule') {
    const s = settings.blocking.schedule;
    title.textContent = t('block.schedule.title');
    lead.textContent = t('block.schedule.lead', { end: s.end });
    if (decision.strict) note.textContent = t('block.strictScheduleNote');
    else offerContinue(decision.passMinutes);
  } else if (reason === 'limit') {
    const day = (await getRaw(dayStorageKey(dayKey())))[dayStorageKey(dayKey())] || {};
    title.textContent = t('block.limit.title');
    lead.textContent = t('block.limit.lead', { host: decision.rule, used: fmtDuration(usageOf(day, decision.rule)), limit: fmtDuration(decision.limitMin * 60) });
    offerContinue(decision.passMinutes);
  } else {
    title.textContent = t('block.always.title', { host });
    lead.textContent = t('block.always.lead');
    $('#manage').hidden = false;
  }
  document.title = title.textContent + ' — EyeTime';
}

(async function main() {
  await bootPage({ onSettings: () => render() });
  await render();
  // re-check when focus ends, a pass is granted or lists change
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.focus || c.passes || c.settings)) render(); });
  setInterval(check, 5000); // schedule windows and limits change without storage events
})();
