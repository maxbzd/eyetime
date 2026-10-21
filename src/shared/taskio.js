// Tasks in and out as plain text: a Markdown checklist (round-trips through quick add) or CSV (for spreadsheets). Pure.

import { taskFromInput, newTaskId } from './tasks.js';
import { MAX_PRIORITIES } from './productivity.js';

const REPEAT_PHRASE = { daily: 'every day', weekdays: 'every weekday', weekly: 'every week' };
const MAX_IMPORT = 500;
const yes = (v) => /^(1|true|yes|y|x|done|да|si|sí|ja|oui|sim)$/i.test(String(v || '').trim());

/** One task as a quick-add line: "Write the report 2026-10-22 14:30 45m ! #work every week". */
export function taskLine(x) {
  const tokens = [];
  if (x.at && x.atDay) tokens.push(x.atDay, x.at); else if (x.due) tokens.push(x.due);
  if (x.est > 0) tokens.push(`${x.est}m`);
  if (x.starred) tokens.push('!');
  for (const g of x.tags || []) tokens.push('#' + g);
  if (x.repeat && REPEAT_PHRASE[x.repeat]) tokens.push(REPEAT_PHRASE[x.repeat]);
  return [String(x.text || '').replace(/\s+/g, ' ').trim(), ...tokens].join(' ');
}

export function tasksToMarkdown(tasks, { title = 'EyeTime tasks' } = {}) {
  const open = (tasks || []).filter((x) => !x.done), done = (tasks || []).filter((x) => x.done);
  const lines = [`# ${title}`, ''];
  for (const x of open) lines.push(`- [ ] ${taskLine(x)}`);
  for (const x of done) lines.push(`- [x] ${taskLine(x)}`);
  return lines.join('\n') + '\n';
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const CSV_HEAD = ['text', 'done', 'priority', 'estimate_min', 'tags', 'repeat', 'due', 'time'];

export function tasksToCsv(tasks) {
  const rows = (tasks || []).map((x) => [x.text, x.done ? 1 : 0, x.starred ? 1 : 0, x.est || '', (x.tags || []).join(' '), x.repeat || '', (x.at && x.atDay) || x.due || '', x.at || '']);
  return [CSV_HEAD, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Minimal CSV reader: quoted cells, doubled quotes, newlines inside quotes; delimiter , ; or tab. */
export function parseCsv(text, delim) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * text → { tasks, skipped }. Accepts Markdown checklists / plain lines (each line goes through quick add, so "Report tomorrow 45m !" works)
 * and CSV with a header row (the one tasksToCsv writes, or any sheet with a "text"/"task"/"title" column). Duplicates of open tasks are skipped.
 */
export function parseTasksText(text, { now = new Date(), existing = [] } = {}) {
  const src = String(text || '').replace(/^﻿/, '');
  const seen = new Set((existing || []).filter((x) => !x.done).map((x) => norm(x.text)));
  let starred = (existing || []).filter((x) => x.starred && !x.done).length;
  const out = []; let skipped = 0;
  const push = (task, done) => {
    if (!task.text) return;
    const key = norm(task.text);
    if (seen.has(key) || out.length >= MAX_IMPORT) { skipped++; return; }
    seen.add(key);
    if (task.starred) { if (starred >= MAX_PRIORITIES) task.starred = false; else starred++; }
    if (done) { task.done = true; task.doneAt = now.getTime(); task.starred = false; }
    out.push(task);
  };

  const first = src.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].find((d) => first.includes(d));
  const head = delim ? first.split(delim).map(norm) : [];
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const tc = col('text', 'task', 'title', 'name');
  if (delim && tc >= 0) {
    const rows = parseCsv(src, delim).slice(1);
    const dc = col('done', 'completed', 'status'), pc = col('priority', 'starred'), ec = col('estimate_min', 'estimate', 'est'), gc = col('tags', 'tag', 'project'), rc = col('repeat'), uc = col('due', 'date'), ac = col('time', 'at');
    for (const r of rows) {
      const text = String(r[tc] || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!text) continue;
      const task = { id: newTaskId(), text, done: false, starred: pc >= 0 && yes(r[pc]), createdAt: now.getTime() };
      const est = ec >= 0 ? Math.round(Number(r[ec])) : 0; if (est >= 1 && est <= 720) task.est = est;
      const tags = gc >= 0 ? String(r[gc] || '').split(/[\s,;]+/).map((g) => g.replace(/^#/, '').toLowerCase()).filter((g) => /^[\p{L}\p{N}_-]{1,24}$/u.test(g)).slice(0, 5) : []; if (tags.length) task.tags = tags;
      const rep = rc >= 0 ? norm(r[rc]) : ''; if (REPEAT_PHRASE[rep]) task.repeat = rep;
      const when = uc >= 0 ? String(r[uc] || '').trim() : ''; const time = ac >= 0 ? String(r[ac] || '').trim() : '';
      const day = /^\d{4}-\d{2}-\d{2}/.test(when) ? when.slice(0, 10) : '';
      if (day && /^\d{2}:\d{2}$/.test(time)) { task.at = time; task.atDay = day; } else if (day) task.due = day;
      push(task, dc >= 0 && yes(r[dc]));
    }
    return { tasks: out, skipped };
  }

  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^#{1,6}\s/.test(line) || /^```/.test(line) || /^[-*_]{3,}$/.test(line)) continue;
    const m = /^(?:[-*+]|\d+[.)])?\s*(?:\[([ xX])\]\s*)?(.+)$/.exec(line);
    if (!m) continue;
    const { task } = taskFromInput(m[2].slice(0, 300), [], now);
    task.starred = !!task.starred;
    push(task, m[1] && m[1].toLowerCase() === 'x');
  }
  return { tasks: out, skipped };
}
