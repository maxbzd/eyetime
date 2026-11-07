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
      lead: "EyeTime is a one-person project, so I can't see whether it really helps you. If you agree, EyeTime will send a few anonymous numbers on its own, once a week, and I'll know what to fix next.",
      title2: 'Can I ask again?',
      lead2: "A few weeks ago you said maybe later, and that's fine. What I fix next depends on these numbers, so I'm asking once more. If you agree, EyeTime will send a few anonymous counts on its own, once a week.",
      title3: 'My last question about this',
      lead3: "I won't ask again after this. If you agree, EyeTime will send a few anonymous counts on its own, once a week, and they decide what I fix and what I remove. If not, that's completely fine.",
      note: 'After you agree it all happens on its own, once a week. Nothing to confirm, and you can stop any time in Settings.',
      never: "Don't ask again", again: '“Maybe later”: I\'ll ask again in a few weeks, three times at most.',
      p1s: 'Never sold, never used for ads or money.', p2s: 'Nothing personal. Just counts: no program names, sites, paths, PINs, name or account.',
      later: 'Maybe later', laterBye: "Okay. I'll ask again in a few weeks.", thanksT: 'Thank you', policy: 'Privacy details', settings: 'Settings', close: 'Close',
      yes: "Yes, I'll help", no: 'No, thanks', show: 'Show exactly what is sent', hide: 'Hide', sign: '— the person who makes EyeTime',
      thanks: 'Thank you! From now on EyeTime sends it on its own, once a week: nothing to confirm. You can see what is sent, or stop, in Settings.', bye: "Of course. I won't ask again.",
      setT: 'Share anonymous numbers', setD: 'Once a week EyeTime sends a few counts on its own. Never names of programs or sites. Off unless you turn it on.', setSee: 'Show what would be sent', setHide: 'Hide',
      setNote: 'This is the whole next report. It is built on your computer and sent over HTTPS without cookies.', setLast: (d) => `Last report: ${d}`, setNever: 'Nothing has been sent yet.',
    },
    ru: {
      title: 'Можно попросить вас об одном маленьком одолжении?',
      lead: 'EyeTime — проект одного человека, поэтому я не вижу, помогает ли он вам на самом деле. Если вы согласитесь, EyeTime сам, раз в неделю, будет отправлять несколько анонимных чисел — так я пойму, что исправлять.',
      title2: 'Можно спросить ещё раз?',
      lead2: 'Несколько недель назад вы ответили «может, позже» — это нормально. От этих чисел зависит, что я исправляю дальше, поэтому спрашиваю ещё раз. Если согласитесь, EyeTime сам, раз в неделю, будет отправлять несколько анонимных счётчиков.',
      title3: 'Мой последний вопрос об этом',
      lead3: 'После этого я больше не спрошу. Если вы согласитесь, EyeTime сам, раз в неделю, будет отправлять несколько анонимных счётчиков — по ним я решаю, что исправить, а что убрать. Если нет — это тоже совершенно нормально.',
      note: 'После вашего согласия всё происходит само, раз в неделю. Ничего подтверждать не нужно, остановить можно в любой момент в Настройках.',
      never: 'Больше не спрашивать', again: '«Может, позже»: спрошу ещё раз через несколько недель, всего не больше трёх раз.',
      p1s: 'Ничего не продаётся и не идёт на рекламу или заработок.', p2s: 'Ничего личного. Только счётчики: без названий программ, сайтов, путей, PIN-кодов, имени и аккаунта.',
      later: 'Может, позже', laterBye: 'Хорошо. Спрошу ещё раз через несколько недель.', thanksT: 'Спасибо', policy: 'Подробнее о приватности', settings: 'Настройки', close: 'Закрыть',
      yes: 'Да, помогу', no: 'Нет, спасибо', show: 'Показать, что именно отправляется', hide: 'Скрыть', sign: '— тот, кто делает EyeTime',
      thanks: 'Спасибо! Дальше EyeTime отправляет всё сам, раз в неделю: подтверждать ничего не нужно. Что именно уходит — видно в Настройках, там же можно остановить.', bye: 'Конечно. Больше не спрошу.',
      setT: 'Делиться анонимными числами', setD: 'Раз в неделю EyeTime сам отправляет несколько счётчиков. Никаких названий программ и сайтов. Выключено, пока вы не включите.', setSee: 'Показать, что будет отправлено', setHide: 'Скрыть',
      setNote: 'Это весь следующий отчёт. Он собирается на вашем компьютере и уходит по HTTPS без куки.', setLast: (d) => `Последний отчёт: ${d}`, setNever: 'Пока ничего не отправлялось.',
    },
  };
  const L = () => TX[lang()] || TX.en;
  const pretty = (text) => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return String(text); } };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const svg = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
  const ICON = { sprout: 'M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.6-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.9ZM14.1 6a3.5 3.5 0 0 0-.8 4.1c1.6-.1 2.9-.9 3.7-2-.3-1.8-1.7-2.5-2.9-2.1Z', ban: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM5.6 5.6l12.8 12.8', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', x: 'M6 6l12 12M18 6L6 18', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' };

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
  /* "Yes" is the filled, wider button. Every way of saying no is a real, bordered, readable button of the same height as each other, side by side, one click: nothing is hidden, shrunk to a link or made hard to read. */
  .tel-act{display:grid;gap:10px;margin-bottom:10px}.tel-no{display:flex;gap:10px}
  .tel-act button,.tel-act a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;flex:1 1 0;height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(220,255,240,.45);background:transparent;color:var(--text,#eaf7f0);font:600 14px var(--font-body,system-ui);cursor:pointer;transition:transform .2s,background .2s}
  .tel-act button:hover,.tel-act a:hover{background:rgba(255,255,255,.07);transform:translateY(-1px)}.tel-act button:active{transform:scale(.97)}
  .tel-act button.go{height:48px;width:100%;background:#f4faf7;color:#04100b;border-color:transparent;box-shadow:0 8px 24px -8px rgba(255,255,255,.35)}
  .tel-links{display:flex;flex-wrap:wrap;gap:4px 16px}.tel-last{margin:0 0 8px;text-align:center}
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

  function showAsk(n, final) {
    if (card || document.getElementById('telAsk')) return;
    const x = L(), c = el('aside', 'tel-card'); c.id = 'telAsk'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'false'); c.setAttribute('aria-labelledby', 'telAskT');
    const badge = el('div', 'tel-badge'); badge.append(svg(ICON.sprout)); badge.setAttribute('aria-hidden', 'true');
    const title = el('h2', 'tel-title', n >= 3 ? x.title3 : n === 2 ? x.title2 : x.title); title.id = 'telAskT';
    const list = el('ul', 'tel-list'); list.append(promise('ban', x.p1s), promise('lock', x.p2s));
    const pre = el('pre', 'tel-pre'); pre.hidden = true; pre.tabIndex = 0;
    const fine2 = el('p', 'tel-fine', L().setNote); fine2.hidden = true;
    const show = el('button', 'tel-show'); show.type = 'button'; show.setAttribute('aria-expanded', 'false'); const lab = el('span', null, x.show); show.append(svg(ICON.eye), lab);
    show.onclick = async () => { const open = show.getAttribute('aria-expanded') !== 'true'; show.setAttribute('aria-expanded', String(open)); lab.textContent = open ? x.hide : x.show; if (open) { await get(); pre.textContent = pretty(v && v.report); } pre.hidden = fine2.hidden = !open; };
    const policy = el('button', 'tel-show'); policy.type = 'button'; policy.append(svg(ICON.lock), el('span', null, x.policy));
    policy.onclick = () => window.__TAURI__.core.invoke('open_target', { kind: 'privacy' }).catch(() => {});
    const yes = el('button', 'go', x.yes); yes.type = 'button';
    yes.onclick = async () => {
      await set('telemetry_set', { on: true });
      // the thank-you stays a few seconds and says where the switch is: withdrawing must be as easy as agreeing
      const ok = el('button', null, x.close); ok.type = 'button'; ok.onclick = leave;
      const act2 = el('div', 'tel-act'); const row = el('div', 'tel-no'); row.append(ok); act2.append(row);
      c.replaceChildren(el('h2', 'tel-title', x.thanksT), el('p', 'tel-lead', x.thanks), act2);
      setTimeout(leave, 9000);
    };
    const later = final ? null : el('button', null, x.later), no = el('button', null, x.no);
    if (later) { later.type = 'button'; later.onclick = async () => { await set('telemetry_defer'); leave(); ET.toast(x.laterBye); }; }
    no.type = 'button'; no.onclick = async () => { await set('telemetry_decline'); leave(); ET.toast(L().bye); };
    const row = el('div', 'tel-no'); if (later) row.append(later); row.append(no);
    const act = el('div', 'tel-act'); act.append(yes, row);
    const never = final ? null : el('button', 'tel-show'); if (never) { never.type = 'button'; never.append(svg(ICON.x), el('span', null, x.never)); never.onclick = async () => { await set('telemetry_decline'); leave(); ET.toast(L().bye); }; }
    const links = el('div', 'tel-links'); links.append(show, policy); if (never) links.append(never);
    c.append(badge, title, el('p', 'tel-lead', n >= 3 ? x.lead3 : n === 2 ? x.lead2 : x.lead), list, el('p', 'tel-fine', x.note), act, final ? document.createComment('') : el('p', 'tel-fine tel-last', x.again), links, fine2, pre, el('p', 'tel-sign', x.sign));
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
  async function look() { await get(); paintRow(); if (v && v.ask && !running() && !document.hidden) showAsk(v.n || 1, !!v.final); }
  setTimeout(look, 9000); setInterval(look, 5 * 60 * 1000);
  document.addEventListener('et-settings-shown', look);
  ET.langHooks.push(() => { paintRow(); });
})();
