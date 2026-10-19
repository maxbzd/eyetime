// Settings sections. Each takes ctx = { s: settings, save(fn), refresh() } and returns an element.

import { h, icon, toast, confirmDialog } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { row, group, toggle, select, segmented, domainEditor, sectionHead } from './ui.js';
import { t, LANGUAGES, weekdayName } from '../shared/i18n.js';
import { PRESETS, PRESET_IDS } from '../shared/catalog.js';
import { ACCENT_NAMES } from '../ui/page.js';
import { exportAll, importAll, resetAll } from '../shared/storage.js';
import { parseUserDomain } from '../shared/domains.js';
import { dayKey } from '../shared/time.js';

const sec = (id, ...kids) => h('section', { class: 'sec', id }, kids);
const mins = (list) => list.map((m) => [m, t('opt.minutes', { n: m })]);

/* ============================== General ============================== */
export function general({ s, save, refresh }) {
  const swatches = h('div', { class: 'row gap-2 wrap' }, ACCENT_NAMES.map((a) => h('button', { type: 'button', class: 'swatch-btn', 'aria-pressed': String(s.accent === a), 'aria-label': t('accent.' + a), 'data-tip': t('accent.' + a), style: { '--c': window.EyeTimeTheme.ACCENTS[a].l[0] }, onclick: () => save((x) => { x.accent = a; }, true) })));
  return sec('general', sectionHead(t('sec.general'), t('sec.generalDesc')),
    group(null,
      row({ title: t('opt.language'), control: select([['auto', t('opt.auto')], ...Object.entries(LANGUAGES)], s.language, (v) => save((x) => { x.language = v; }, true), { label: t('opt.language') }) }),
      row({ title: t('opt.theme'), control: segmented([['system', t('opt.themeSystem'), 'monitor'], ['light', t('opt.themeLight'), 'sun'], ['dark', t('opt.themeDark'), 'moon']], s.theme, (v) => save((x) => { x.theme = v; }, true), t('opt.theme')) }),
      row({ title: t('opt.accent'), control: swatches })),
    group(t('opt.groupHome'),
      row({ title: t('opt.homeEnabled'), desc: t('opt.homeEnabledDesc'), control: toggle(s.newtab.enabled, (v) => save((x) => { x.newtab.enabled = v; }), t('opt.homeEnabled')) }),
      row({ title: t('opt.homeCustomize'), desc: t('opt.homeCustomizeDesc'), control: h('a', { class: 'btn', href: chrome.runtime.getURL('src/newtab/newtab.html') }, icon('sliders-horizontal'), t('home.customize')) })),
    group(t('opt.groupNotify'),
      row({ title: t('opt.badge'), desc: t('opt.badgeDesc'), control: toggle(s.tracking.badge, (v) => save((x) => { x.tracking.badge = v; }), t('opt.badge')) }),
      row({ title: t('opt.weekly'), desc: t('opt.weeklyDesc'), control: toggle(s.weeklyReport, (v) => save((x) => { x.weeklyReport = v; }), t('opt.weekly')) })));
}

/* ============================== Focus ============================== */
export function focus({ s, save, refresh }) {
  const presetsIn = h('input', { class: 'input input-sm', style: { width: '180px' }, value: s.focus.presets.join(', '), 'aria-label': t('opt.focusPresets'), onchange: (e) => {
    const list = [...new Set(e.target.value.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 720))].slice(0, 5);
    if (!list.length) { e.target.value = s.focus.presets.join(', '); return; }
    save((x) => { x.focus.presets = list; if (!list.includes(x.focus.minutes)) x.focus.minutes = list[0]; }, true);
  } });
  const urlIn = h('input', { class: 'input input-sm', style: { width: '260px' }, type: 'url', placeholder: 'https://…', value: s.focus.openUrl, 'aria-label': t('opt.focusUrl'), onchange: (e) => {
    const v = e.target.value.trim();
    if (v && !/^https?:\/\//i.test(v)) { toast(t('links.invalid')); e.target.value = s.focus.openUrl; return; }
    save((x) => { x.focus.openUrl = v; });
  } });
  return sec('focus', sectionHead(t('sec.focus'), t('sec.focusDesc')),
    group(null,
      row({ title: t('opt.focusDefault'), desc: t('opt.focusDefaultDesc'), control: select(s.focus.presets.map((m) => [m, t('opt.minutes', { n: m })]), s.focus.minutes, (v) => save((x) => { x.focus.minutes = Number(v); }), { label: t('opt.focusDefault') }) }),
      row({ title: t('opt.focusPresets'), desc: t('opt.focusPresetsDesc'), control: presetsIn }),
      row({ title: t('focus.strict'), desc: t('opt.strictDesc'), control: toggle(s.focus.strict, (v) => save((x) => { x.focus.strict = v; }), t('focus.strict')) })),
    group(t('opt.groupExtras'),
      row({ title: t('opt.focusSound'), desc: t('opt.focusSoundDesc'), control: toggle(s.focus.sound, (v) => save((x) => { x.focus.sound = v; }), t('opt.focusSound')) }),
      row({ title: t('opt.focusUrl'), desc: t('opt.focusUrlDesc'), control: urlIn }),
      row({ title: t('opt.suggestBreak'), desc: t('opt.suggestBreakDesc'), control: toggle(s.focus.suggestBreak, (v) => save((x) => { x.focus.suggestBreak = v; }), t('opt.suggestBreak')) })));
}

/* ============================== Blocking ============================== */
export function blocking({ s, save, refresh }) {
  const b = s.blocking;
  const presetCards = h('div', { class: 'preset-grid' }, PRESET_IDS.map((id) => {
    const on = !!b.presets[id];
    return h('label', { class: 'preset' + (on ? ' on' : '') },
      h('span', { class: 'ic' }, icon(PRESETS[id].icon)),
      h('span', { class: 'grow' }, h('div', { class: 'nm', text: t('preset.' + id) }), h('div', { class: 'ct', text: t('preset.count', { n: PRESETS[id].domains.length }) })),
      toggle(on, (v) => save((x) => { x.blocking.presets[id] = v; }, true), t('preset.' + id)));
  }));

  const addTo = (key) => (d) => save((x) => { if (!x.blocking[key].includes(d)) x.blocking[key].push(d); }, true);
  const removeFrom = (key) => (d) => save((x) => { x.blocking[key] = x.blocking[key].filter((v) => v !== d); }, true);

  const sch = b.schedule;
  const days = h('div', { class: 'days', role: 'group', 'aria-label': t('opt.schedDays') }, [1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(sch.days.includes(d)), onclick: () => save((x) => { const set = new Set(x.blocking.schedule.days); set.has(d) ? set.delete(d) : set.add(d); x.blocking.schedule.days = [...set].sort(); }, true) }, weekdayName(d))));
  const time = (key) => h('input', { class: 'input input-sm', type: 'time', value: sch[key], 'aria-label': key === 'start' ? t('opt.schedStart') : t('opt.schedEnd'), onchange: (e) => { if (e.target.value) save((x) => { x.blocking.schedule[key] = e.target.value; }); } });

  const fr = b.friction;
  const feed = b.feed;

  // limits
  const limitList = Object.entries(b.limits).sort();
  const dIn = h('input', { class: 'input', type: 'text', placeholder: 'youtube.com', 'aria-label': t('opt.limitSite'), spellcheck: false });
  const mIn = h('input', { class: 'input', type: 'number', min: 1, max: 1440, value: 30, 'aria-label': t('opt.limitMinutes') });
  const addLimit = () => {
    const d = parseUserDomain(dIn.value); const m = Math.round(Number(mIn.value));
    if (!d) { toast(t('domains.invalid', { v: dIn.value })); return; }
    if (!(m >= 1)) return;
    save((x) => { x.blocking.limits[d] = m; }, true);
  };
  const limits = h('div', { class: 'card' },
    limitList.length ? limitList.map(([d, m]) => h('div', { class: 'limit-row' }, h('span', { class: 'nm', text: d }), h('span', { class: 'muted num', text: t('opt.perDay', { n: m }) }),
      h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove') + ' ' + d, onclick: () => save((x) => { delete x.blocking.limits[d]; }, true) }, icon('x')))) : h('div', { class: 'setting' }, h('div', { class: 'setting-desc', text: t('opt.limitsEmpty') })),
    h('div', { class: 'add-limit', style: { borderTop: limitList.length ? '1px solid var(--border)' : 'none' } }, dIn, mIn, h('span', { class: 'muted', text: t('opt.minPerDay') }), h('button', { class: 'btn', type: 'button', onclick: addLimit }, icon('plus'), t('common.add'))));

  return sec('blocking', sectionHead(t('sec.blocking'), t('sec.blockingDesc')),
    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupWhat') }), presetCards),
    group(null,
      row({ title: t('opt.custom'), desc: t('opt.customDesc'), stack: true, control: domainEditor({ items: b.custom, onAdd: addTo('custom'), onRemove: removeFrom('custom'), placeholder: 'example.com' }) }),
      row({ title: t('opt.allow'), desc: t('opt.allowDesc'), stack: true, control: domainEditor({ items: b.allow, onAdd: addTo('allow'), onRemove: removeFrom('allow'), placeholder: 'example.com' }) })),

    group(t('opt.groupFriction'),
      row({ title: t('opt.friction'), desc: t('opt.frictionDesc'), control: toggle(fr.enabled, (v) => save((x) => { x.blocking.friction.enabled = v; }, true), t('opt.friction')) }),
      fr.enabled ? row({ title: t('opt.frictionSeconds'), control: select([5, 8, 10, 15, 30].map((n) => [n, t('opt.seconds', { n })]), fr.seconds, (v) => save((x) => { x.blocking.friction.seconds = Number(v); }), { label: t('opt.frictionSeconds') }) }) : null,
      row({ title: t('opt.passMinutes'), desc: t('opt.passMinutesDesc'), control: select(mins([5, 10, 15, 30]), fr.passMinutes, (v) => save((x) => { x.blocking.friction.passMinutes = Number(v); }), { label: t('opt.passMinutes') }) })),

    group(t('opt.groupSchedule'),
      row({ title: t('opt.schedule'), desc: t('opt.scheduleDesc'), control: toggle(sch.enabled, (v) => save((x) => { x.blocking.schedule.enabled = v; }, true), t('opt.schedule')) }),
      sch.enabled ? [
        row({ title: t('opt.schedDays'), stack: true, control: days }),
        row({ title: t('opt.schedHours'), control: h('div', { class: 'row gap-2' }, time('start'), h('span', { class: 'muted', text: '–' }), time('end')) }),
        row({ title: t('opt.schedStrict'), desc: t('opt.schedStrictDesc'), control: toggle(sch.strict, (v) => save((x) => { x.blocking.schedule.strict = v; }), t('opt.schedStrict')) }),
      ] : null),

    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupLimits') }), h('p', { class: 'hint', style: { margin: '-4px 4px 10px' }, text: t('opt.limitsDesc') }), limits),

    group(t('opt.groupAlways'), row({ title: t('opt.always'), desc: t('opt.alwaysDesc'), stack: true, control: domainEditor({ items: b.always, onAdd: addTo('always'), onRemove: removeFrom('always'), placeholder: 'example.com', empty: t('opt.alwaysEmpty') }) })),

    group(t('opt.groupFeed'),
      row({ title: t('opt.shortLimit'), desc: t('opt.shortLimitDesc'), control: toggle(feed.shortLimit, (v) => save((x) => { x.blocking.feed.shortLimit = v; }, true), t('opt.shortLimit')) }),
      feed.shortLimit ? row({ title: t('opt.shortMinutes'), control: select(mins([1, 3, 5, 10, 15]), feed.shortMinutes, (v) => save((x) => { x.blocking.feed.shortMinutes = Number(v); }), { label: t('opt.shortMinutes') }) }) : null,
      row({ title: t('opt.hideShorts'), desc: t('opt.hideShortsDesc'), control: toggle(feed.hideShorts, (v) => save((x) => { x.blocking.feed.hideShorts = v; }), t('opt.hideShorts')) }),
      row({ title: t('opt.hideRecs'), desc: t('opt.hideRecsDesc'), control: toggle(feed.hideRecs, (v) => save((x) => { x.blocking.feed.hideRecs = v; }), t('opt.hideRecs')) }),
      row({ title: t('opt.hideHome'), desc: t('opt.hideHomeDesc'), control: toggle(feed.hideHome, (v) => save((x) => { x.blocking.feed.hideHome = v; }), t('opt.hideHome')) }),
      row({ title: t('opt.hideComments'), control: toggle(feed.hideComments, (v) => save((x) => { x.blocking.feed.hideComments = v; }), t('opt.hideComments')) })));
}

/* ============================== Eye care ============================== */
export function eye({ s, save }) {
  const e = s.eye;
  return sec('eye', sectionHead(t('sec.eye'), t('sec.eyeDesc')),
    group(null,
      row({ title: t('opt.eyeEnabled'), desc: t('opt.eyeEnabledDesc'), control: toggle(e.enabled, (v) => save((x) => { x.eye.enabled = v; }, true), t('opt.eyeEnabled')) }),
      e.enabled ? [
        row({ title: t('opt.eyeInterval'), desc: t('opt.eyeIntervalDesc'), control: select(mins([15, 20, 30, 45, 60]), e.intervalMin, (v) => save((x) => { x.eye.intervalMin = Number(v); }), { label: t('opt.eyeInterval') }) }),
        row({ title: t('opt.eyeLength'), control: select([20, 30, 60].map((n) => [n, t('opt.seconds', { n })]), e.breakSeconds, (v) => save((x) => { x.eye.breakSeconds = Number(v); }), { label: t('opt.eyeLength') }) }),
        row({ title: t('opt.eyeNotify'), desc: t('opt.eyeNotifyDesc'), control: toggle(e.notify, (v) => save((x) => { x.eye.notify = v; }), t('opt.eyeNotify')) }),
        row({ title: t('opt.eyePreview'), control: h('button', { class: 'btn', type: 'button', onclick: () => send('break:open') }, icon('eye'), t('opt.eyePreviewBtn')) }),
      ] : null),
    group(t('opt.groupBedtime'),
      row({ title: t('opt.bedtime'), desc: t('opt.bedtimeDesc'), control: toggle(e.bedtime.enabled, (v) => save((x) => { x.eye.bedtime.enabled = v; }, true), t('opt.bedtime')) }),
      e.bedtime.enabled ? [
        row({ title: t('opt.bedtimeAt'), control: h('input', { class: 'input input-sm', type: 'time', value: e.bedtime.time, 'aria-label': t('opt.bedtimeAt'), onchange: (ev) => { if (ev.target.value) save((x) => { x.eye.bedtime.time = ev.target.value; }); } }) }),
        row({ title: t('opt.bedtimeLead'), control: select(mins([15, 30, 45, 60]), e.bedtime.leadMin, (v) => save((x) => { x.eye.bedtime.leadMin = Number(v); }), { label: t('opt.bedtimeLead') }) }),
      ] : null));
}

/* ============================== Tracking ============================== */
export function tracking({ s, save, refresh }) {
  const tr = s.tracking, comp = s.companion;
  const status = h('span', { class: 'badge', id: 'compStatus', text: '' });

  async function setCompanion(on) {
    if (on) {
      const ok = await chrome.permissions.request({ origins: ['http://127.0.0.1:8765/*'] }).catch(() => false);
      if (!ok) { toast(t('opt.compDenied')); refresh(); return; }
    }
    await save((x) => { x.companion.enabled = on; }, true);
  }
  const tokenIn = h('input', { class: 'input input-sm token', style: { width: '240px' }, placeholder: t('opt.compTokenPh'), value: comp.token, spellcheck: false, 'aria-label': t('opt.compToken'), onchange: (e) => save((x) => { x.companion.token = e.target.value.trim(); }, true) });

  return sec('tracking', sectionHead(t('sec.tracking'), t('sec.trackingDesc')),
    group(null,
      row({ title: t('opt.trackEnabled'), desc: t('opt.trackEnabledDesc'), control: toggle(tr.enabled, (v) => save((x) => { x.tracking.enabled = v; }, true), t('opt.trackEnabled')) }),
      row({ title: t('opt.idle'), desc: t('opt.idleDesc'), control: select([[30, t('opt.seconds', { n: 30 })], [60, t('opt.minutes', { n: 1 })], [120, t('opt.minutes', { n: 2 })], [300, t('opt.minutes', { n: 5 })]], tr.idleSeconds, (v) => save((x) => { x.tracking.idleSeconds = Number(v); }, true), { label: t('opt.idle') }) }),
      row({ title: t('opt.audible'), desc: t('opt.audibleDesc'), control: toggle(tr.countAudible, (v) => save((x) => { x.tracking.countAudible = v; }), t('opt.audible')) }),
      row({ title: t('opt.incognito'), desc: t('opt.incognitoDesc'), control: toggle(tr.incognito, (v) => save((x) => { x.tracking.incognito = v; }), t('opt.incognito')) })),
    group(t('opt.groupExcluded'), row({ title: t('opt.excluded'), desc: t('opt.excludedDesc'), stack: true, control: domainEditor({ items: tr.excluded, placeholder: 'example.com',
      onAdd: (d) => save((x) => { if (!x.tracking.excluded.includes(d)) x.tracking.excluded.push(d); }, true), onRemove: (d) => save((x) => { x.tracking.excluded = x.tracking.excluded.filter((v) => v !== d); }, true) }) })),
    group(t('opt.groupCompanion'),
      row({ title: t('opt.comp'), desc: t('opt.compDesc'), control: h('div', { class: 'row gap-3' }, status, toggle(comp.enabled, setCompanion, t('opt.comp'))) }),
      comp.enabled ? row({ title: t('opt.compToken'), desc: t('opt.compTokenDesc'), control: tokenIn }) : null,
      row({ title: t('opt.compHow'), desc: t('opt.compHowDesc'), control: h('a', { class: 'btn', href: 'https://github.com/maxbzd/eyetime/tree/main/companion', target: '_blank', rel: 'noopener' }, icon('external-link'), t('opt.compDocs')) })));
}

/* ============================== Data & privacy ============================== */
export function data({ s, save, refresh }) {
  const PERMS = [['storage', 'perm.storage'], ['tabs', 'perm.tabs'], ['webNavigation', 'perm.webNavigation'], ['idle', 'perm.idle'], ['alarms', 'perm.alarms'], ['notifications', 'perm.notifications'], ['offscreen', 'perm.offscreen'], ['favicon', 'perm.favicon'], ['youtube/instagram/tiktok/vk', 'perm.hosts']];
  async function doExport() {
    const payload = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    const a = h('a', { href: url, download: `eyetime-backup-${dayKey()}.json` }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  async function doImport(file) {
    try {
      const payload = JSON.parse(await file.text());
      const ok = await confirmDialog({ title: t('opt.importTitle'), body: t('opt.importBody'), confirm: t('opt.importConfirm'), danger: true });
      if (!ok) return;
      await importAll(payload); toast(t('opt.importDone')); setTimeout(() => location.reload(), 600);
    } catch { toast(t('opt.importFail')); }
  }
  const fileIn = document.getElementById('importFile');
  fileIn.onchange = () => { if (fileIn.files[0]) doImport(fileIn.files[0]); fileIn.value = ''; };

  return sec('data', sectionHead(t('sec.data'), t('sec.dataDesc')),
    group(null,
      row({ title: t('opt.export'), desc: t('opt.exportDesc'), control: h('button', { class: 'btn', type: 'button', onclick: doExport }, icon('download'), t('opt.exportBtn')) }),
      row({ title: t('opt.import'), desc: t('opt.importDesc'), control: h('button', { class: 'btn', type: 'button', onclick: () => fileIn.click() }, icon('upload'), t('opt.importBtn')) }),
      row({ title: t('opt.csv'), desc: t('opt.csvDesc'), control: h('a', { class: 'btn', href: chrome.runtime.getURL('src/insights/insights.html') }, icon('chart-column'), t('nav.insights')) })),
    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupPrivacy') }),
      h('div', { class: 'card' }, h('div', { class: 'setting' }, h('div', { class: 'setting-text' }, h('div', { class: 'setting-title', text: t('opt.privacyTitle') }), h('div', { class: 'setting-desc', text: t('opt.privacyBody') }))),
        h('div', { style: { borderTop: '1px solid var(--border)' } }, PERMS.map(([p, k]) => h('div', { class: 'perm' }, h('b', { text: p }), h('span', { text: t(k) })))))),
    h('div', {}, h('h3', { class: 'group-title', text: t('opt.groupDanger') }),
      h('div', { class: 'card danger-zone' }, row({ title: t('opt.reset'), desc: t('opt.resetDesc'), control: h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
        const ok = await confirmDialog({ title: t('opt.resetTitle'), body: t('opt.resetBody'), confirm: t('opt.resetConfirm'), danger: true });
        if (ok) { await resetAll(); toast(t('opt.resetDone')); setTimeout(() => location.reload(), 600); }
      } }, icon('trash-2'), t('opt.resetBtn')) }))));
}

/* ============================== About ============================== */
export function about() {
  const v = chrome.runtime.getManifest().version;
  const link = (href, ico, label) => h('a', { class: 'btn', href, target: '_blank', rel: 'noopener' }, ico, label);
  return sec('about', sectionHead(t('sec.about')),
    h('div', { class: 'card' },
      h('div', { class: 'about-logo' }, h('img', { src: '../../icons/logo.svg', alt: '' }), h('div', {}, h('h3', { text: 'EyeTime' }), h('div', { class: 'muted', text: t('about.version', { v }) }), h('div', { class: 'muted', text: t('about.tagline') }))),
      h('div', { class: 'row gap-2 wrap', style: { padding: '0 var(--s-5) var(--s-5)' } },
        link('https://github.com/maxbzd/eyetime', icon('code-xml'), t('about.source')),
        link('https://github.com/maxbzd/eyetime/issues/new/choose', icon('bug'), t('about.report')),
        link('https://github.com/maxbzd/eyetime/blob/main/PRIVACY.md', icon('shield-check'), t('about.privacy')))),
    group(t('about.shortcuts'),
      row({ title: t('about.scFocus'), control: h('span', { class: 'shortcut' }, ['Alt', 'Shift', 'F'].map((k) => h('span', { class: 'kbd', text: k }))) }),
      row({ title: t('about.scPopup'), control: h('span', { class: 'shortcut' }, ['Alt', 'Shift', 'E'].map((k) => h('span', { class: 'kbd', text: k }))) }),
      row({ title: t('about.scChange'), control: h('button', { class: 'btn', type: 'button', onclick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, icon('keyboard'), t('about.scBtn')) })));
}
