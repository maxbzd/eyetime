// Dates in plain words for quick add: "tomorrow", "friday", "in 3 days", "next week" — in English, Russian, Spanish, German, French, Portuguese, Italian, Polish, Ukrainian, Chinese and Japanese.
// Pure: findDateWord(text, now) → { day: 'YYYY-MM-DD', raw, index } | null, where `raw` is the matched text at `index` (the caller removes it from the task title).
// Only unambiguous words count: no 3-letter weekday abbreviations ("sat", "sun", "mon" are ordinary words), no bare "segunda" / "quarta" (also "second", "fourth").

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (now, n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);

/** Days from today to the next `dow` (0 = Sunday); the same weekday as today means next week. */
const upcoming = (now, dow) => ((dow - now.getDay() + 7) % 7) || 7;

// [regex source, resolver(match, now) → Date]. Every regex is anchored by the callers with whitespace lookarounds.
const WEEKDAYS = [
  // [dow, words in all languages]
  [1, 'monday|понедельник[а]?|lunes|montag|lundi|segunda-feira|luned[ìi]|poniedzia[łl]ek|понеділок'],
  [2, 'tuesday|вторник[а]?|martes|dienstag|mardi|ter[cç]a-feira|marted[ìi]|wtorek|вівторок'],
  [3, 'wednesday|mi[eé]rcoles|mittwoch|mercredi|quarta-feira|mercoled[ìi]|[śs]rod[aęy]|серед[ауи]'],
  [4, 'thursday|четверг[а]?|jueves|donnerstag|jeudi|quinta-feira|gioved[ìi]|czwartek|четвер'],
  [5, 'friday|пятниц[ауы]|viernes|freitag|vendredi|sexta-feira|venerd[ìi]|pi[ąa]tek|п[’\'ʼ]ятниц[яюі]'],
  [6, 'saturday|суббот[ауы]|s[aá]bado|samstag|sonnabend|samedi|sabato|sobot[aęy]|субот[аиу]'],
  [0, 'sunday|воскресень[еяю]|domingo|sonntag|dimanche|domenica|niedziel[aęi]|неділ[яюі]'],
];
// Portuguese weekdays without "-feira" are also ordinal numbers: accept them only after "na / no / nesta / próxima".
const PT_BARE = [[1, 'segunda'], [2, 'ter[cç]a'], [3, 'quarta'], [4, 'quinta'], [5, 'sexta']];

// optional words in front of a weekday that belong to the date phrase ("on friday", "в пятницу", "el lunes", "am montag", "ce vendredi", "na sexta")
const LEAD = '(?:(?:on|next|this|в|во|к|el|este|pr[oó]ximo|am|n[aä]chsten|kommenden|le|ce|na|nesta|neste|pr[oó]xima|w|we|u|у)\\s+)?';
// words that may follow ("friday next", "vendredi prochain")
const TRAIL = '(?:\\s+(?:prochain|next|prossimo))?';

const RULES = [];
const add = (src, fn) => RULES.push([new RegExp(`(?<=\\s)(${src})(?=\\s|$)`, 'iu'), fn]);

// the day after tomorrow first (it contains "tomorrow" words)
add('послезавтра|pasado\\s+ma[nñ]ana|[uü]bermorgen|apr[eè]s-demain|depois\\s+de\\s+amanh[aã]|day\\s+after\\s+tomorrow|dopodomani|pojutrze|післязавтра', (m, now) => plus(now, 2));
add('today|сегодня|hoy|heute|aujourd[’\']hui|hoje|oggi|dzisiaj|dzi[śs]|сьогодні', (m, now) => plus(now, 0));
add('tomorrow|завтра|ma[nñ]ana|morgen|demain|amanh[aã]|domani|jutro', (m, now) => plus(now, 1));
// "in 3 days" / "через 3 дня" / "en 3 días" / "in 3 Tagen" / "dans 3 jours" / "em 3 dias"
add('(?:(?:in|через|en|dans|em|tra|fra|za)\\s+(\\d{1,3})\\s+(?:days?|дн(?:я|ей|ь|і|ів)|d[ií]as?|tagen?|jours?|giorn[oi]|dni|dzie[nń])|за\\s+(\\d{1,3})\\s+дн(?:і|ів))', (m, now) => plus(now, Number(/(\d{1,3})/.exec(m[0])[1])));
// next week → the coming Monday
add('next\\s+week|на\\s+следующей\\s+неделе|la\\s+semana\\s+que\\s+viene|(?:in\\s+der\\s+)?n[aä]chste[nr]?\\s+woche|la\\s+semaine\\s+prochaine|semana\\s+que\\s+vem|(?:la\\s+)?settimana\\s+prossima|la\\s+prossima\\s+settimana|w\\s+przysz[łl]ym\\s+tygodniu|przysz[łl]y\\s+tydzie[nń]|наступного\\s+тижня|наступний\\s+тиждень', (m, now) => plus(now, upcoming(now, 1)));
// "this friday" said on a Friday is today; a bare weekday on its own day means next week
const thisWord = /^(?:this|este|ce|nesta|neste)\s/i;
for (const [dow, words] of WEEKDAYS) add(`${LEAD}(?:${words})${TRAIL}`, (m, now) => plus(now, thisWord.test(m[0]) && dow === now.getDay() ? 0 : upcoming(now, dow)));
// Portuguese "no sábado / no domingo" (masculine days take "no"; "no" is left out of LEAD because of "no friday meetings")
add('no\\s+(?:s[aá]bado|domingo)', (m, now) => plus(now, upcoming(now, /s/i.test(m[0].slice(3, 4)) ? 6 : 0)));
// "среда" is also "environment": only with a preposition (в среду, до среды, к среде)
add('(?:в|во|до|к|на)\\s+сред[ауые]', (m, now) => plus(now, upcoming(now, 3)));
for (const [dow, word] of PT_BARE) add(`(?:na|no|nesta|neste|pr[oó]xima|pr[oó]ximo)\\s+${word}`, (m, now) => plus(now, upcoming(now, dow)));
// ISO date: 2026-10-24 (the one numeric form every language agrees on)
add('(\\d{4})-(\\d{2})-(\\d{2})', (m, now) => { const d = new Date(+m[2], +m[3] - 1, +m[4]); return d.getMonth() === +m[3] - 1 && d >= plus(now, 0) ? d : null; }); // a date in the past is just text

// Chinese and Japanese: no spaces between words, so these rules have no whitespace guards. A repeat marker right before ("每周五", "毎週金曜日") makes it a repeat, not a date.
const addCjk = (src, fn) => RULES.push([new RegExp(`(${src})`, 'gu'), fn, true]);
const ZH_DOW = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
const JA_DOW = { '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0 };
const nextWeekDay = (now, dow) => upcoming(now, 1) + ((dow + 6) % 7); // the coming Monday + the weekday's offset in a Monday-first week
addCjk('大后天(?:的)?', (m, now) => plus(now, 3));
addCjk('(?<!大)后天(?:的)?', (m, now) => plus(now, 2));
addCjk('今天(?:的)?', (m, now) => plus(now, 0));
addCjk('明天(?:的)?', (m, now) => plus(now, 1));
addCjk('(\\d{1,3})天(?:之)?后', (m, now) => plus(now, Number(m[2])));
addCjk('(?<!下)下(?:个)?(?:周|星期|礼拜)(?![一二三四五六日天])(?:的)?', (m, now) => plus(now, upcoming(now, 1)));
addCjk('(?<![一二两三四五六七八九十几每上下\\d])(这|本|下)?(?:个)?(?:周|星期|礼拜)([一二三四五六日天])(?!(?<=一)[定起次般直些样切]|(?<=日)[程记报期常用]|(?<=[二三])[个次])(?:之前|以前|前)?', (m, now) => { const dow = ZH_DOW[m[3]]; return plus(now, m[2] === '下' ? nextWeekDay(now, dow) : m[2] && dow === now.getDay() ? 0 : upcoming(now, dow)); });
addCjk('明後日(?:の|までに|まで|には|に|は)?|明后日', (m, now) => plus(now, 2));
addCjk('今日(?:の|までに|まで|には|に|は)?', (m, now) => plus(now, 0));
addCjk('明日(?:の|までに|まで|には|に|は)?', (m, now) => plus(now, 1));
addCjk('(\\d{1,3})日後(?:の|までに|まで|には|に|は)?', (m, now) => plus(now, Number(m[2])));
addCjk('来週(?!の?[月火水木金土日]曜)(?:の|までに|まで|には|に|は)?', (m, now) => plus(now, upcoming(now, 1)));
addCjk('(来週|今週)?(?:の)?([月火水木金土日])曜日?(?:までに|まで|には|に|は|の)?', (m, now) => { const dow = JA_DOW[m[3]]; return plus(now, m[2] === '来週' ? nextWeekDay(now, dow) : m[2] === '今週' && dow === now.getDay() ? 0 : upcoming(now, dow)); });

export function findDateWord(text, now = new Date()) {
  const s = ` ${text} `;
  let best = null;
  for (const [re, fn, cjk] of RULES) {
    let m;
    if (cjk) { // the first match that is not a repeat ("每周五", "毎週金曜日") or a past day ("上周五", "先週の金曜日")
      for (const c of s.matchAll(re)) { if (!/(?:[每毎](?:个|週|周)?|先週の?|上(?:个)?|前(?:个)?)$/u.test(s.slice(Math.max(0, c.index - 3), c.index))) { m = c; break; } }
    } else m = re.exec(s);
    if (!m) continue;
    // "mañana" is also "morning" in "por la mañana" / "de la mañana": not a date there
    if (/ma[nñ]ana/i.test(m[1]) && /(?:la|de\s+la|esta)\s+$/i.test(s.slice(0, m.index))) continue;
    // words that make the weekday a repeat ("every monday") or the "morgen" a morning ("jeden morgen", "am morgen") are not a date
    const before = (/(\S+)\s+$/.exec(s.slice(0, m.index)) || [])[1] || '';
    if (/^(?:every|каждый|каждую|каждое|cada|jeden|jede|jeder|chaque|todo|toda|todos|tous|toutes|ogni|ciascun|ciascuno|ciascuna|il|ka[żz]d[yąaeo]|ka[żz]dej|co|кожен|кожна|кожне|кожну|кожного|кожної|щоп[’']?ятниці)$/i.test(before) && !/\d/.test(m[1])) continue;
    if (/^morgen$/i.test(m[1]) && /^(?:am|jeden|jedem|jeder|guten|heute|gestern|den|dem|der|des|ein|eines|diesen|dieser)$/i.test(before)) continue;
    const d = fn(m, now);
    if (!d) continue;
    if (!best || m.index < best.index) best = { index: m.index, raw: m[1], day: keyOf(d) };
  }
  return best ? { day: best.day, raw: best.raw, index: best.index - 1 } : null; // index in `text` (the padded copy shifts it by one)
}
