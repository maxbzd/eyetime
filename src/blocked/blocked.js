import { bootPage } from '../ui/page.js';
import { $, favicon, clear, h } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { evaluate } from '../shared/policy.js';
import { getSettings, getRaw, dayStorageKey, updateSettings, getCollection, setCollection } from '../shared/storage.js';
import { matches } from '../shared/domains.js';
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
  if (decision?.reason === 'friction') send('pause:reason', { reason: 'back' });
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
  if (!target) { clear($('#stage'), h('h1', { text: t('block.invalid') }), h('p', { class: 'lead', text: t('block.invalidBody') }), h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary btn-lg', href: chrome.runtime.getURL('src/newtab/newtab.html'), text: t('block.newTab') }))); return; }
  settings = await getSettings();
  decision = await check();
  if (!decision) return;

  const reason = decision.reason;
  const back = $('#back'), cont = $('#cont'), lead = $('#lead'), title = $('#title'), note = $('#note');
  const wait = Math.max(5, settings.blocking.friction.seconds || 8);
  $('#sitePill').replaceChildren(favicon(host), h('span', { class: 'host', text: host, title: host }));
  back.textContent = t('block.back'); back.onclick = goBack;
  $('#breath').hidden = true; $('#bigClock').hidden = true; $('#goal').hidden = true; $('#manage').hidden = true; $('#manage').textContent = t('block.manage'); $('#why').hidden = true; $('#allowSite').hidden = true; $('#plan').hidden = true; $('#park').hidden = true;
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
    // implementation intention: the user's own "if I want X, then I will Y" — specific to this site first, then any generic one
    const plans = settings.blocking.plans || [];
    const mine = plans.filter((p) => p.when && matches(host, p.when)), generic = plans.filter((p) => !p.when);
    const pool = mine.length ? mine : generic;
    if (pool.length) { const p = pool[Math.floor(Date.now() / 60000) % pool.length]; $('#plan').hidden = false; $('#planText').textContent = t('block.plan.text', { host, then: p.then }); }
    const park = $('#park'); park.hidden = false;
    park.onclick = async () => {
      const notes = await getCollection('captures', []);
      notes.unshift({ id: Date.now().toString(36), text: t('block.park.note', { host }), at: Date.now() });
      await setCollection('captures', notes);
      goBack();
    };
    // intent: naming why you are here is the speed bump — and "autopilot" is a cue to turn around
    let chosen = '';
    const chips = $('#why'); chips.hidden = false;
    clear($('#whyChips'), ['work', 'break', 'habit', 'bored'].map((r) => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', text: t('block.why.' + r), onclick: (e) => {
      chosen = chosen === r ? '' : r;
      $('#whyChips').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget && !!chosen)));
      $('#whyNote').textContent = chosen === 'habit' || chosen === 'bored' ? t('block.why.nudge') : '';
    } })));
    note.textContent = t('block.passNote', { n: decision.passMinutes });
    waitThen(cont, decision.seconds || wait, t('block.continue'));
    cont.hidden = false;
    cont.onclick = async () => { if (chosen) await send('pause:reason', { reason: chosen }); await send('pass:grant', { rule: decision.rule, minutes: decision.passMinutes }); release(); };
    return;
  }

  if (reason === 'focus') {
    const f = decision.focus;
    const only = decision.scope === 'only-mine';
    title.textContent = t(only ? 'block.only.title' : 'block.focus.title');
    lead.textContent = t(only ? 'block.only.lead' : 'block.focus.lead', { host });
    if (only) {
      const a = $('#allowSite'); a.hidden = false; a.textContent = t('block.only.allowHost', { host });
      a.onclick = async () => { await updateSettings((s) => { if (!s.blocking.allow.includes(host)) s.blocking.allow.push(host); }); await send('settings:changed'); release(); };
    }
    if (f?.goal) { $('#goal').hidden = false; $('#goal').replaceChildren(h('span', { class: 'goal-k', text: t('block.goalK') }), h('span', { text: f.goal })); }
    const big = $('#bigClock'); big.hidden = false;
    const paint = () => { const left = f.endsAt - Date.now(); big.textContent = clock(Math.max(0, left)); big.dataset.k = t('block.remaining'); if (left <= 0) { render(); } };
    paint(); timers.push(setInterval(paint, 1000));
    if (decision.strict) note.textContent = t('block.strictNote', { time: fmtTime(new Date(f.endsAt), settings.newtab.clock24 === null ? undefined : settings.newtab.clock24) });
    else offerContinue(decision.passMinutes);
  } else if (reason === 'schedule') {
    const s = settings.blocking.schedule;
    title.textContent = t('block.schedule.title');
    const [eh, em] = String(s.end).split(':').map(Number);
    lead.textContent = t('block.schedule.lead', { end: fmtTime(new Date(2000, 0, 1, eh || 0, em || 0), settings.newtab.clock24 === null ? undefined : settings.newtab.clock24) });
    if (decision.strict) note.textContent = t('block.strictScheduleNote');
    else offerContinue(decision.passMinutes);
  } else if (reason === 'budget') {
    title.textContent = t('block.budget.title');
    lead.textContent = t('block.budget.lead', { used: fmtDuration(decision.usedSec), limit: fmtDuration(decision.budgetMin * 60) });
    offerContinue(decision.passMinutes);
    $('#manage').hidden = false; $('#manage').textContent = t('block.changeLimit');
  } else if (reason === 'limit') {
    const day = (await getRaw(dayStorageKey(dayKey())))[dayStorageKey(dayKey())] || {};
    title.textContent = t('block.limit.title');
    lead.textContent = t('block.limit.lead', { host: decision.rule, used: fmtDuration(usageOf(day, decision.rule)), limit: fmtDuration(decision.limitMin * 60) });
    offerContinue(decision.passMinutes);
    $('#manage').hidden = false; $('#manage').textContent = t('block.changeLimit');
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
