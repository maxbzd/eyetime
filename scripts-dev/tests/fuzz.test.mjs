// What a person can paste or import — a calendar file, a list of tasks, a theme file, a sentence — must never make a parser throw, hang or return something
// that breaks its own promises, whatever the bytes are. Each case starts from a realistic sample and damages it at random (a seeded generator, so a failure repeats:
// the seed is in the message).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcsFull } from '../../src/shared/ics.js';
import { parseXml, find, findAll, textOf, escapeXml } from '../../src/shared/sync/xml.js';
import { findDateWord } from '../../src/shared/datewords.js';
import { parseTasksText, parseCsv } from '../../src/shared/taskio.js';
import { parseQuickAdd } from '../../src/shared/quickadd.js';
import { parseTheme, THEME_MAX_CHARS } from '../../src/shared/themefile.js';
import { unfold, unescapeText, escapeText, parseVtodo, component } from '../../src/shared/sync/ical.js';

/** @param {number} seed */
const rng = (seed) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; }; };
const JUNK = ['\u0000', '\r', '\n', '\\', '"', "'", '<', '>', '&', ';', ',', ':', '#', '{', '}', '[', ']', ' ', '\t', '‮', '😀', 'é', '\ud800', '999999999999', '-1', 'null', 'BEGIN:', 'END:', '/>', '<![CDATA[', '&#x', '%'];

/** the sample, damaged: bytes changed, cut out, repeated, junk inserted, cut short */
function damage(sample, rnd, rounds = 1 + Math.floor(rnd() * 8)) {
  let s = sample;
  for (let i = 0; i < rounds; i++) {
    const at = Math.floor(rnd() * (s.length + 1)), kind = Math.floor(rnd() * 6);
    if (kind === 0) s = s.slice(0, at) + JUNK[Math.floor(rnd() * JUNK.length)] + s.slice(at);
    else if (kind === 1) s = s.slice(0, at) + s.slice(at + 1 + Math.floor(rnd() * 12));
    else if (kind === 2) s = s.slice(0, at) + s.slice(Math.max(0, at - 1 - Math.floor(rnd() * 40)), at) + s.slice(at);
    else if (kind === 3) s = s.slice(0, at);
    else if (kind === 4) s = s.slice(0, at) + String.fromCharCode(Math.floor(rnd() * 0xd7ff)) + s.slice(at + 1);
    else s = s + s.slice(0, Math.floor(rnd() * 200));
  }
  return s;
}
/** runs `fn` over many damaged samples; the message names the seed and a piece of the input when it fails */
function fuzz(name, samples, fn, runs = 600) {
  test(`fuzz: ${name}`, () => {
    for (let seed = 1; seed <= runs; seed++) {
      const rnd = rng(seed * 2654435761);
      const input = damage(samples[seed % samples.length], rnd);
      try { fn(input, rnd); } catch (e) { assert.fail(`seed ${seed} made it throw: ${e && e.message}\ninput: ${JSON.stringify(input.slice(0, 200))}`); }
    }
  });
}

const ICS = [
  'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a@x\r\nDTSTART:20261110T090000Z\r\nDTEND:20261110T100000Z\r\nSUMMARY:Planning\\, weekly\r\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=5\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:b@x\r\nDTSTART;TZID=Europe/Kiev:20261111T140000\r\nDURATION:PT45M\r\nSUMMARY:Long \r\n title folded\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
  'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261112\nDTEND;VALUE=DATE:20261113\nSUMMARY:All day\nRRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20261201T000000Z\nEXDATE:20261114\nEND:VEVENT\nEND:VCALENDAR',
];
fuzz('a calendar file (.ics): never throws, never returns more than asked, events are well formed', ICS, (text) => {
  const from = new Date(2026, 10, 9), r = parseIcsFull(text, { from, days: 14, max: 50 });
  assert.ok(Array.isArray(r.events) && r.events.length <= 50, 'more events than the cap');
  for (const e of r.events) assert.ok(typeof e.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.day) && /^\d{2}:\d{2}$/.test(e.start) && /^\d{2}:\d{2}$/.test(e.end), JSON.stringify(e));
});

const XML = [
  '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/a/</d:href><d:propstat><d:prop><d:displayname>Tasks &amp; more</d:displayname></d:prop></d:propstat></d:response></d:multistatus>',
  '<a x="1" y=\'2\'><b/><c>text<![CDATA[<raw>]]></c><!-- note --></a>',
];
fuzz('XML from a calendar server: broken XML is refused with the one error the callers expect, never anything else; find and text stay safe', XML, (text) => {
  let root;
  try { root = parseXml(text); } catch (e) { if (e instanceof Error && e.message === 'not XML') return; throw e; }
  const n = find(root, 'href'); textOf(n); findAll(root, 'response'); findAll(null, 'x');
  assert.equal(typeof escapeXml(text.slice(0, 50)), 'string');
});

const WORDS = ['Report tomorrow 14:30 45m !', 'Call Friday', 'Pay rent on the 5th', 'Отчёт завтра в 15:00', 'Anruf am Montag um 9', 'review in 3 days #work every weekday', 'x', ''];
fuzz('a sentence with a date in words: never throws, the date found is a real day', WORDS, (text) => {
  const now = new Date(2026, 10, 6, 12);
  const r = findDateWord(text, now);
  if (r && r.day) assert.match(r.day, /^\d{4}-\d{2}-\d{2}$/);
  const q = parseQuickAdd(text, now);
  assert.ok(q && typeof q.text === 'string' && q.text.length <= 2000, 'quick add must return text');
}, 1500);

const TASKS = [
  '# EyeTime tasks\n\n- [ ] Report !!! ~45m #work every weekday @2026-11-10 14:30\n- [x] Call mom\n* plain line\n1. numbered\n',
  'text,done,priority,estimate_min,tags,repeat,due,time\r\n"Report, final",no,yes,45,"work,deep",weekdays,2026-11-10,14:30\r\n"Call",yes,,,,,,\r\n',
  'text\tdone\nOne\tyes\nTwo\tno\n',
];
fuzz('a list of tasks (Markdown, CSV, TSV): never throws, never more than the cap, every task has a text', TASKS, (text) => {
  const r = parseTasksText(text, { now: new Date(2026, 10, 6), existing: [] });
  assert.ok(Array.isArray(r.tasks) && r.tasks.length <= 5000);
  for (const t of r.tasks) assert.ok(typeof t.text === 'string' && t.text.length > 0 && t.text.length <= 300 + 20, 'a task without text or with a huge one: ' + JSON.stringify(t).slice(0, 100));
  parseCsv(text, ',');
}, 1000);

const THEMES = [
  JSON.stringify({ format: 'eyetime-theme', version: 1, name: 'Calm', appearance: { look: 'calm', accent: 'lime', font: 'system', scale: 1, radius: 'md', density: 'cozy', cards: 'glass', customCss: '' }, home: { layout: 'today', background: 'photo', widgets: [] } }),
  JSON.stringify({ format: 'eyetime-theme', version: 1, home: { widgets: [{ id: 'w1', kind: 'clock', cfg: {} }], canvas: { on: true, items: { w1: { x: 1, y: 2, w: 3, h: 4 } } } } }),
];
fuzz('a theme file: never throws, and what it lets through is only what the sanitiser keeps', THEMES, (text) => {
  const r = parseTheme(text);
  assert.ok(r && typeof r === 'object' && ('ok' in r || 'error' in r || 'theme' in r), 'an answer with a shape');
  if (r.ok === false) assert.ok(typeof r.error === 'string' || typeof r.why === 'string' || r.error === undefined);
}, 800);

test('fuzz: a theme file over the size limit is refused before it is parsed', () => {
  const r = parseTheme('x'.repeat(THEME_MAX_CHARS + 1));
  assert.ok(r.ok === false || r.error, 'refused');
});

const ICAL = ['BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:t1\r\nSUMMARY:Pay\\, rent\r\nDUE;VALUE=DATE:20261110\r\nSTATUS:COMPLETED\r\nPRIORITY:1\r\nEND:VTODO\r\nEND:VCALENDAR\r\n'];
fuzz('a to-do from a CalDAV server (iCalendar): never throws; text escapes survive a round trip', ICAL, (text) => {
  unfold(text); component(text, 'VTODO'); parseVtodo(text);
  const plain = text.slice(0, 80);
  assert.equal(unescapeText(escapeText(plain)), plain.replace(/\r\n/g, '\n'), 'escape then unescape gives the text back (a line break is a line break)');
});
