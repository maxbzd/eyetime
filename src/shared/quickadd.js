// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Natural quick-add for tasks: "Write the report 14:30 45m !" → { text, at, est, priority, tags }.
// Conservative on purpose: only well-formed tokens are taken out of the text, everything else stays part of the title.

import { findDateWord } from './datewords.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * The part of the day that says which half of the clock "7" means: 7 in the evening is 19:00, 9 in the morning is 09:00, 11 at night is 23:00, 3 at night is 03:00.
 * Said after the time ("в 7 вечера", "at 7 in the evening") or in front of it ("вечером в 7", "tonight at 7").
 */
const PERIODS = {
  morning: 'утра|утром|ранку|ранком|in the morning|morgens|de la ma[ñn]ana|du matin|da manh[ãa]|di mattina|rano|dimine[tț]ii?',
  day: 'дня|днём|днем|вдень|удень|in the afternoon|nachmittags|de la tarde|de l.apr[eè]s-midi|da tarde|del pomeriggio|po po[łl]udniu|dup[ăa]-amiaz[ăa]',
  evening: 'вечера|вечером|вечора|ввечері|in the evening|this evening|tonight|abends|du soir|della sera|di sera|wieczorem|seara|sear[ăa]',
  night: 'ночи|ночью|ночі|вночі|at night|nachts|de la noche|de la nuit|da noite|di notte|w nocy|noaptea',
};
const PERIOD_AFTER = new RegExp(`^\\s*(?:(${PERIODS.morning})|(${PERIODS.day})|(${PERIODS.evening})|(${PERIODS.night}))(?=[\\s!,;.]|$)`, 'iu');
const PERIOD_BEFORE = new RegExp(`(?:^|\\s)(?:(${PERIODS.morning})|(${PERIODS.day})|(${PERIODS.evening})|(${PERIODS.night}))\\s*$`, 'iu');
/** hour on a 24-hour clock for a number 1–12 said with a part of the day */
function withPeriod(hh, /** @type {boolean[]} */ [morning, day, evening, night]) {
  if (hh < 1 || hh > 12) return hh; // already a 24-hour time
  if (morning) return hh === 12 ? 0 : hh;
  if (day) return hh <= 6 ? hh + 12 : hh; // "1 дня" is 13:00, "12 дня" is noon; nobody says "11 дня"
  if (evening) return hh < 12 ? hh + 12 : hh;
  if (night) return hh === 12 ? 0 : hh >= 9 ? hh + 12 : hh; // 9, 10, 11 at night are 21, 22, 23; 1 to 8 stay small hours
  return hh;
}

/** Parse a time token to 'HH:MM' or null. Accepts 14:30, 14.30, 2pm, 2:30pm, @14:30, at 14:30, в 14:30. */
function toTime(h, m, ap) {
  let hh = Number(h); const mm = m === undefined ? 0 : Number(m);
  if (ap) { const pm = /^p/i.test(ap); if (hh < 1 || hh > 12) return null; hh = (hh % 12) + (pm ? 12 : 0); }
  if (hh > 23 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

export function parseQuickAdd(input, now = new Date()) {
  let text = ` ${String(input || '').trim()} `;
  const out = { text: '', at: null, atDay: null, due: null, est: null, priority: false, tags: [], repeat: null };

  // a day in words: tomorrow · friday · in 3 days · next week (6 languages)
  const dw = findDateWord(text, now);
  if (dw) { text = text.slice(0, dw.index) + ' ' + text.slice(dw.index + dw.raw.length); out.due = dw.day; }

  // time: @14:30 · at 2pm · в 14:30 · 14:30 · 2:30pm   (a bare number such as "3" is NOT a time)
  // a dot is a decimal point far more often than a time separator ("12.50", "chapter 10.15"): it only counts with am/pm or @/at/в
  const timeRe = /(?<=\s)(@|at\s+|в\s+)?(\d{1,2})(?:([:.])(\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)?(?=\s|$)/i;
  const matches = [...text.matchAll(new RegExp(timeRe.source, 'gi'))].map((m) => ({ raw: m[0], index: m.index, prefix: m[1], h: m[2], sep: m[3], m: m[4], ap: m[5] && m[5].replace(/\./g, '') }));
  const ts = matches.find((x) => (x.m !== undefined || x.ap !== undefined || x.prefix) && (x.sep !== '.' || x.ap || x.prefix) && toTime(x.h, x.m, x.ap));
  if (ts) {
    let from = ts.index, to = ts.index + ts.raw.length, hour = ts.h;
    if (!ts.ap) { // "7 вечера" / "вечером в 7": the part of the day settles which 7
      const after = PERIOD_AFTER.exec(text.slice(to)), before = PERIOD_BEFORE.exec(text.slice(0, from));
      const hit = after || before;
      if (hit) { hour = String(withPeriod(Number(ts.h), hit.slice(1, 5).map(Boolean))); if (after) to += after[0].length; else from = before.index; }
    }
    out.at = toTime(hour, ts.m, ts.ap);
    text = text.slice(0, from) + ' ' + text.slice(to);
  }

  // estimate: 25m · 25 min · 45мин · 1.5h · 2ч
  const both = /(?<=\s)(\d{1,2})\s?(?:h|hr|hrs|ч|год\.|годин)\s?(\d{1,2})\s?(?:m|min|mins|мин|м|хв)(?=[\s!,;]|$)/i.exec(text); // 1h 30m · 1ч 30м · 2 год 15 хв
  const est = both ? null : /(?<=\s)(\d{1,3}(?:[.,]\d)?)\s?(m|min|mins|мин|м|h|hr|hrs|ч|хв|год\.|годин)(?=[\s!,;]|$)/i.exec(text);
  if (both) {
    const minutes = Number(both[1]) * 60 + Number(both[2]);
    if (minutes >= 1 && minutes <= 720) { out.est = minutes; text = text.replace(both[0], ' '); }
  } else if (est) {
    const n = Number(est[1].replace(',', '.')), hours = /^(h|hr|hrs|ч|год\.|годин)$/i.test(est[2]);
    const minutes = Math.round(hours ? n * 60 : n);
    if (minutes >= 1 && minutes <= 720) { out.est = minutes; text = text.replace(est[0], ' '); }
  }

  // priority: a standalone "!" / "!1" / "!!"
  const pri = /(?<=\s)!{1,2}1?(?=\s|$)/.exec(text);
  if (pri) { out.priority = true; text = text.replace(pri[0], ' '); }

  // #tags
  for (const m of text.matchAll(/(?<=\s)#([\p{L}\p{N}_-]{1,24})(?=\s|$)/gu)) out.tags.push(m[1].toLowerCase());
  text = text.replace(/(?<=\s)#[\p{L}\p{N}_-]{1,24}(?=\s|$)/gu, ' ');

  // repetition (English, Russian, Spanish, German, French, Portuguese, Romanian). Clear phrases count anywhere; the bare one-word forms only at the
  // very end, so "Prepare weekly report" stays a task called "Prepare weekly report".
  const CLEAR = 'every\\s+day|every\\s+weekday|every\\s+week|каждый\\s+день|ежедневно|по\\s+будням|каждую\\s+неделю|еженедельно|cada\\s+d[ií]a|todos\\s+los\\s+d[ií]as|entre\\s+semana|cada\\s+semana|jeden\\s+tag|an\\s+wochentagen|jede\\s+woche|chaque\\s+jour|tous\\s+les\\s+jours|en\\s+semaine|chaque\\s+semaine|todo\\s+dia|todos\\s+os\\s+dias|dias\\s+[uú]teis|toda\\s+semana|a\\s+cada\\s+semana|ogni\\s+giorno|tutti\\s+i\\s+giorni|ogni\\s+settimana|nei\\s+giorni\\s+feriali|co\\s+tydzie[nń]|w\\s+dni\\s+robocze|ka[żz]dego\\s+dnia|по\\s+буднях|щотижня|кожного\\s+дня|[îi]n\\s+fiecare\\s+zi|[îi]n\\s+zilele\\s+lucr[ăa]toare|[îi]n\\s+fiecare\\s+s[ăa]pt[ăa]m[âa]n[ăa]';
  const BARE = 'daily|weekdays|weekly|t[aä]glich|werktags|w[oö]chentlich|diario|semanal|quotidien|hebdomadaire|di[aá]rio|diariamente|codziennie|щодня|zilnic|s[ăa]pt[ăa]m[âa]nal';
  const rep = new RegExp(`(?<=\\s)(${CLEAR})(?=\\s|$)`, 'i').exec(text) || new RegExp(`(?<=\\s)(${BARE})(?=\\s*$)`, 'i').exec(text);
  if (rep) {
    const w = rep[1].toLowerCase().replace(/\s+/g, ' ');
    out.repeat = /weekday|будням|буднях|wochentag|werktag|entre semana|en semaine|dias [uú]teis|feriali|robocze|lucr[ăa]toare/.test(w) ? 'weekdays' : /week|недел|woche|semana|semaine|hebdo|settimana|tydzie|тижн|s[ăa]pt[ăa]m[âa]n/.test(w) ? 'weekly' : 'daily';
    text = text.replace(rep[0], ' ');
  }

  // Chinese / Japanese repeat markers carry no spaces around them
  if (!rep) {
    const cj = /每天|每日|每个工作日|每(?:周|星期|礼拜)[一二三四五六日天]?|毎日|毎週(?:[月火水木金土日]曜日?)?|毎平日/u.exec(text);
    if (cj) { out.repeat = /工作日|平日/u.test(cj[0]) ? 'weekdays' : /周|星期|礼拜|週/u.test(cj[0]) ? 'weekly' : 'daily'; text = text.replace(cj[0], ' '); }
  }

  out.text = text.replace(/\s+/g, ' ').trim();
  if (out.at) {
    const [hh, mm] = out.at.split(':').map(Number);
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    const day = when.getTime() <= now.getTime() ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now;
    out.atDay = out.due || `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    out.due = null; // a time already pins the day
  }
  if (!out.text) return { text: String(input || '').trim(), at: null, atDay: null, due: null, est: null, priority: false, tags: [], repeat: null }; // never turn a task into nothing
  return out;
}

/** Planning fallacy: how far off are your estimates? Uses finished tasks that have an estimate and at least 5 minutes of tracked focus. */
export function estimateAccuracy(tasks) {
  const rows = (tasks || []).filter((x) => x.done && x.est > 0 && x.focusSec >= 300).map((x) => ({ id: x.id, text: x.text, est: x.est, actual: Math.round(x.focusSec / 60), ratio: x.focusSec / 60 / x.est }));
  if (rows.length < 3) return null;
  const sorted = rows.map((r) => r.ratio).sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { n: rows.length, median, verdict: median > 1.15 ? 'under' : median < 0.85 ? 'over' : 'good', rows: rows.slice(0, 5) };
}
