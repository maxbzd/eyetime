// Natural quick-add for tasks: "Write the report 14:30 45m !" → { text, at, est, priority, tags }.
// Conservative on purpose: only well-formed tokens are taken out of the text, everything else stays part of the title.

const pad = (n) => String(n).padStart(2, '0');

/** Parse a time token to 'HH:MM' or null. Accepts 14:30, 14.30, 2pm, 2:30pm, @14:30, at 14:30, в 14:30. */
function toTime(h, m, ap) {
  let hh = Number(h); const mm = m === undefined ? 0 : Number(m);
  if (ap) { const pm = /^p/i.test(ap); if (hh < 1 || hh > 12) return null; hh = (hh % 12) + (pm ? 12 : 0); }
  if (hh > 23 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

export function parseQuickAdd(input, now = new Date()) {
  let text = ` ${String(input || '').trim()} `;
  const out = { text: '', at: null, atDay: null, est: null, priority: false, tags: [] };

  // time: @14:30 · at 2pm · в 14:30 · 14:30 · 2:30pm   (a bare number such as "3" is NOT a time)
  const timeRe = /(?<=\s)(?:@|at\s+|в\s+)?(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)?(?=\s|$)/i;
  const ts = [...text.matchAll(new RegExp(timeRe.source, 'gi'))].find((m) => (m[2] !== undefined || m[3] !== undefined || /^(@|at|в)/i.test(m[0].trim())) && toTime(m[1], m[2], m[3] && m[3].replace(/\./g, '')));
  if (ts) { out.at = toTime(ts[1], ts[2], ts[3] && ts[3].replace(/\./g, '')); text = text.replace(ts[0], ' '); }

  // estimate: 25m · 25 min · 45мин · 1.5h · 2ч
  const est = /(?<=\s)(\d{1,3}(?:[.,]\d)?)\s?(m|min|mins|мин|м|h|hr|hrs|ч)(?=\s|$)/i.exec(text);
  if (est) {
    const n = Number(est[1].replace(',', '.')), hours = /^(h|hr|hrs|ч)$/i.test(est[2]);
    const minutes = Math.round(hours ? n * 60 : n);
    if (minutes >= 1 && minutes <= 720) { out.est = minutes; text = text.replace(est[0], ' '); }
  }

  // priority: a standalone "!" / "!1" / "!!"
  const pri = /(?<=\s)!{1,2}1?(?=\s|$)/.exec(text);
  if (pri) { out.priority = true; text = text.replace(pri[0], ' '); }

  // #tags
  for (const m of text.matchAll(/(?<=\s)#([\p{L}\p{N}_-]{1,24})(?=\s|$)/gu)) out.tags.push(m[1].toLowerCase());
  text = text.replace(/(?<=\s)#[\p{L}\p{N}_-]{1,24}(?=\s|$)/gu, ' ');

  out.text = text.replace(/\s+/g, ' ').trim();
  if (out.at) {
    const [hh, mm] = out.at.split(':').map(Number);
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    const day = when.getTime() <= now.getTime() ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now;
    out.atDay = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  }
  if (!out.text) return { text: String(input || '').trim(), at: null, atDay: null, est: null, priority: false, tags: [] }; // never turn a task into nothing
  return out;
}

/** Planning fallacy: how far off are your estimates? Uses finished tasks that have an estimate and at least 5 minutes of tracked focus. */
export function estimateAccuracy(tasks) {
  const rows = (tasks || []).filter((x) => x.done && x.est > 0 && x.focusSec >= 300).map((x) => ({ id: x.id, text: x.text, est: x.est, actual: Math.round(x.focusSec / 60), ratio: x.focusSec / 60 / x.est }));
  if (rows.length < 3) return null;
  const sorted = rows.map((r) => r.ratio).sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { n: rows.length, median, verdict: median > 1.15 ? 'under' : median < 0.85 ? 'over' : 'good', rows: rows.slice(-5) };
}
