// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
/* The optional anonymous numbers, as the person sees them: one note in the corner, once, after a few days of use, and a switch in Settings.
   The helper decides everything (whether to ask, what the next report says, when it goes); this file only shows it and sends the answer.
   It is written like a note from a person, not like a consent banner: who asks and why, three plain promises, the exact report one click away, an honest "no".
   Nothing here is built from data as HTML: the report is put in as text. */
(() => {
  'use strict';
  const ETB = window.ETB, ET = window.ET;
  if (!ETB || !ETB.req || !ET || !window.__TAURI__) return;
  const lang = () => ET.lang();

  const TX = {
    en: {
      title: 'May I ask you a small favour?',
      lead: 'EyeTime is made by one person, and I have no way of knowing whether it really helps you. If you agree, once a week it will send a few anonymous numbers, so I can see what to fix next.',
      p1: 'Never sold. Not to advertisers, not to anyone.',
      p2: 'Never used for money. No ads, no profiles. The numbers only help me make EyeTime better.',
      p3: 'Nothing personal. Just counts, like how many times something was closed. No program names, sites, paths, window titles, PINs or codes, no name, no account.',
      note: 'You can read the exact report first, and turn this off with one click, whenever you like.',
      yes: "Yes, I'll help", no: 'No, thanks', show: 'Show exactly what is sent', hide: 'Hide', sign: '— the person who makes EyeTime',
      thanks: 'Thank you, truly. You can see what is sent, and stop, in Settings.', bye: "Of course. I won't ask again.",
      setT: 'Share anonymous numbers', setD: 'Once a week, a few counts. Never names of programs or sites. Off unless you turn it on.', setSee: 'Show what would be sent', setHide: 'Hide',
      setNote: 'This is the whole next report. It is built on your computer and sent over HTTPS without cookies.', setLast: (d) => `Last report: ${d}`, setNever: 'Nothing has been sent yet.',
    },
    ru: {
      title: 'Можно попросить вас об одном маленьком одолжении?',
      lead: 'EyeTime делает один человек, и я не могу узнать, правда ли он вам помогает. Если вы согласитесь, раз в неделю он будет отправлять несколько анонимных чисел — так я пойму, что исправлять в первую очередь.',
      p1: 'Ничего не продаётся. Ни рекламодателям, ни кому-либо ещё.',
      p2: 'Не ради заработка. Никакой рекламы и профилей: цифры нужны только затем, чтобы EyeTime становился лучше.',
      p3: 'Ничего личного. Только счётчики, например сколько раз что-то было закрыто. Никаких названий программ, сайтов, путей, заголовков окон, PIN-кодов, ни имени, ни аккаунта.',
      note: 'Точный отчёт можно прочитать до отправки, а выключить всё — одним нажатием в любой момент.',
      yes: 'Да, помогу', no: 'Нет, спасибо', show: 'Показать, что именно отправляется', hide: 'Скрыть', sign: '— тот, кто делает EyeTime',
      thanks: 'Спасибо, правда. Что отправляется и как остановить, видно в Настройках.', bye: 'Конечно. Больше не спрошу.',
      setT: 'Делиться анонимными числами', setD: 'Раз в неделю несколько счётчиков. Никаких названий программ и сайтов. Выключено, пока вы не включите.', setSee: 'Показать, что будет отправлено', setHide: 'Скрыть',
      setNote: 'Это весь следующий отчёт. Он собирается на вашем компьютере и уходит по HTTPS без куки.', setLast: (d) => `Последний отчёт: ${d}`, setNever: 'Пока ничего не отправлялось.',
    },
  };
  const L = () => TX[lang()] || TX.en;
  const pretty = (text) => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return String(text); } };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const svg = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
  const ICON = { sprout: 'M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.6-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.9ZM14.1 6a3.5 3.5 0 0 0-.8 4.1c1.6-.1 2.9-.9 3.7-2-.3-1.8-1.7-2.5-2.9-2.1Z', ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM5.6 5.6l12.8 12.8', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' };

  const css = document.createElement('style');
  css.textContent = `
  .tel-card{position:fixed;right:24px;bottom:24px;z-index:170;width:min(392px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;padding:26px 26px 20px;border-radius:30px;color:var(--text,#eaf7f0);
    background:radial-gradient(120% 70% at 0% 0%,rgba(140,242,198,.16),transparent 60%),linear-gradient(180deg,rgba(26,38,33,.96),rgba(9,14,12,.97));border:1px solid var(--edge-hi,rgba(220,255,240,.3));
    box-shadow:0 40px 100px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07);animation:telIn .6s var(--spring,ease) both}
  .tel-card.leaving{animation:telOut .26s ease forwards;pointer-events:none}
  @keyframes telIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}@keyframes telOut{to{opacity:0;transform:translateY(10px) scale(.97)}}
  .tel-badge{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;margin-bottom:14px;background:linear-gradient(135deg,var(--mint,#8cf2c6),var(--sky,#86d7ff));color:#04100b}
  .tel-badge svg,.tel-ico svg,.tel-show svg{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.tel-badge svg{width:22px;height:22px}
  .tel-title{margin:0 0 8px;font:300 28px/1.15 var(--font-display,Outfit,system-ui);letter-spacing:-.01em;text-wrap:balance}
  .tel-lead{margin:0 0 16px;font-size:14px;line-height:1.55;color:var(--text-2,#9bb);text-wrap:pretty}
  .tel-list{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:12px}
  .tel-list li{display:grid;grid-template-columns:32px 1fr;gap:12px;align-items:start;font-size:13px;line-height:1.5;color:var(--text-2,#9bb)}.tel-list b{color:var(--text,#fff);font-weight:650}
  .tel-ico{display:grid;place-items:center;width:32px;height:32px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--edge,rgba(200,255,230,.13));color:var(--mint,#8cf2c6)}.tel-ico svg{width:16px;height:16px}
  .tel-fine{margin:0 0 14px;font-size:12px;line-height:1.5;color:var(--text-3,#789)}
  .tel-act{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
  .tel-act button{flex:1 1 auto;height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--edge,rgba(200,255,230,.2));background:rgba(255,255,255,.06);color:inherit;font:600 14px var(--font-body,system-ui);cursor:pointer;transition:transform .2s}
  .tel-act button:hover{transform:translateY(-1px)}.tel-act button:active{transform:scale(.97)}
  .tel-act button.go{background:#f4faf7;color:#04100b;border-color:transparent;box-shadow:0 8px 24px -8px rgba(255,255,255,.35)}
  .tel-show{display:inline-flex;align-items:center;gap:6px;padding:4px 2px;margin:0 0 8px;border:0;background:none;color:var(--text-2,#9bb);font:500 12px var(--font-body,system-ui);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
  .tel-show:hover{color:var(--text,#fff)}.tel-show svg{width:14px;height:14px}
  .tel-pre{margin:0 0 10px;padding:12px;max-height:190px;overflow:auto;border-radius:14px;background:rgba(0,0,0,.28);border:1px solid var(--edge,rgba(200,255,230,.13));font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--text-2,#9bb);white-space:pre-wrap;word-break:break-all}
  .tel-pre[hidden],.tel-fine[hidden]{display:none}
  .tel-sign{margin:6px 0 0;text-align:right;font:italic 300 17px var(--font-display,Outfit,system-ui);color:var(--text-3,#789)}
  .tel-card button:focus-visible,#telRow button:focus-visible{outline:2px solid var(--mint,#8cf2c6);outline-offset:2px}
  #telRow .tel-pre{grid-column:1/-1;margin:10px 0 0}
  @media (max-width:640px){.tel-card{right:12px;left:12px;bottom:12px;width:auto;padding:22px}}`;
  document.head.append(css);

  let v = null, card = null;
  const get = async () => { const r = await ETB.req({ op: 'telemetry_get' }); if (r.ok && r.data) v = r.data; return v; };
  const set = async (op, extra) => { const r = await ETB.req({ op, ...(extra || {}) }); if (r.ok && r.data) v = r.data; paintRow(); return r; };

  function promise(ico, text) {
    const m = /^(.+?[.。])\s*(.*)$/s.exec(text), ic = el('span', 'tel-ico'); ic.append(svg(ICON[ico])); ic.setAttribute('aria-hidden', 'true');
    const t = el('span'); if (m) { t.append(el('b', null, m[1]), ' ' + m[2]); } else t.textContent = text;
    const li = el('li'); li.append(ic, t); return li;
  }
  function leave() { if (!card) return; const c = card; card = null; c.classList.add('leaving'); setTimeout(() => c.remove(), 280); }

  function showAsk() {
    if (card || document.getElementById('telAsk')) return;
    const x = L(), c = el('aside', 'tel-card'); c.id = 'telAsk'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'false'); c.setAttribute('aria-labelledby', 'telAskT');
    const badge = el('div', 'tel-badge'); badge.append(svg(ICON.sprout)); badge.setAttribute('aria-hidden', 'true');
    const title = el('h2', 'tel-title', x.title); title.id = 'telAskT';
    const list = el('ul', 'tel-list'); list.append(promise('ban', x.p1), promise('sprout', x.p2), promise('lock', x.p3));
    const pre = el('pre', 'tel-pre'); pre.hidden = true; pre.tabIndex = 0;
    const fine2 = el('p', 'tel-fine', L().setNote); fine2.hidden = true;
    const show = el('button', 'tel-show'); show.type = 'button'; show.setAttribute('aria-expanded', 'false'); const lab = el('span', null, x.show); show.append(svg(ICON.eye), lab);
    show.onclick = async () => { const open = show.getAttribute('aria-expanded') !== 'true'; show.setAttribute('aria-expanded', String(open)); lab.textContent = open ? x.hide : x.show; if (open) { await get(); pre.textContent = pretty(v && v.report); } pre.hidden = fine2.hidden = !open; };
    const yes = el('button', 'go', x.yes), no = el('button', null, x.no); yes.type = no.type = 'button';
    yes.onclick = async () => { await set('telemetry_set', { on: true }); leave(); ET.toast(L().thanks); };
    no.onclick = async () => { await set('telemetry_decline'); leave(); ET.toast(L().bye); };
    const act = el('div', 'tel-act'); act.append(yes, no);
    c.append(badge, title, el('p', 'tel-lead', x.lead), list, el('p', 'tel-fine', x.note), act, show, fine2, pre, el('p', 'tel-sign', x.sign));
    document.body.append(c); card = c;
  }

  /* ---------------------------------------------------------------- the switch in Settings (only in a build that has somewhere to send) */
  function paintRow() {
    const grp = document.getElementById('etbUpdGroup') || (document.getElementById('sUpd') && document.getElementById('sUpd').closest('.st-group'));
    if (!grp || !v) return;
    let row = document.getElementById('telRow');
    if (!v.configured) { if (row) row.remove(); return; }
    if (!row) {
      row = el('div', 'st-row'); row.id = 'telRow';
      const t = el('div', 't'); t.append(el('b'), el('span'));
      const c = el('div', 'c'); const see = el('button', 'btn-s'); see.type = 'button'; see.id = 'telSee';
      const sw = el('button', 'upd-sw'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.id = 'telSw';
      const pre = el('pre', 'tel-pre'); pre.hidden = true; pre.id = 'telPre'; pre.tabIndex = 0;
      c.append(see, sw); row.append(t, c, pre); grp.append(row);
      sw.onclick = async () => { await set('telemetry_set', { on: sw.getAttribute('aria-checked') !== 'true' }); };
      see.onclick = async () => { const open = pre.hidden; if (open) { await get(); pre.textContent = pretty(v && v.report); } pre.hidden = !open; paintRow(); };
    }
    const [b, s] = row.querySelectorAll('.t b, .t span'), sw = row.querySelector('#telSw'), see = row.querySelector('#telSee'), pre = row.querySelector('#telPre');
    b.textContent = L().setT; s.textContent = v.on ? (v.lastReportMs > 0 ? L().setLast(new Date(v.lastReportMs).toLocaleDateString(lang() === 'ru' ? 'ru-RU' : 'en-GB')) : L().setNever) : L().setD;
    sw.setAttribute('aria-checked', String(!!v.on)); sw.setAttribute('aria-label', L().setT);
    see.textContent = pre.hidden ? L().setSee : L().setHide;
  }

  const running = () => { const st = ETB.getStatus && ETB.getStatus(); return !!(st && st.session); };
  async function look() { await get(); paintRow(); if (v && v.ask && !running() && !document.hidden) showAsk(); }
  setTimeout(look, 9000); setInterval(look, 5 * 60 * 1000);
  document.addEventListener('et-settings-shown', look);
  ET.langHooks.push(() => { paintRow(); });
})();
