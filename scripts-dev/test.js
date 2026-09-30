// Dependency-free unit tests: node scripts-dev/test.js
const assert = require('assert');
const B = require('../assets/blocking.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓ ' + name); };
const at = (day, h, m) => new Date(2026, 0, 4 + day, h, m); // 2026-01-04 is a Sunday → day 0

t('defaults block previous hard-coded distraction sites', () => {
  ['youtube.com', 'm.youtube.com', 'reddit.com', 'x.com', 'vk.com', 'tiktok.com', 'instagram.com', 'twitch.tv'].forEach(d => assert(B.isDistraction(d, {}), d));
  assert(!B.isDistraction('github.com', {}));
});
t('presets toggle and custom domains', () => {
  const s = { blocking: { presets: { news: true }, customDistractions: ['example.org'] } };
  assert(B.isDistraction('bbc.com', s)); assert(B.isDistraction('sub.example.org', s)); assert(!B.isDistraction('youtube.com', s));
});
t('allow-list wins over presets', () => {
  const s = { blocking: { presets: { video: true }, allowedDomains: ['youtube.com'] } };
  assert(!B.isDistraction('youtube.com', s)); assert(B.isDistraction('twitch.tv', s));
});
t('schedule: disabled by default', () => assert(!B.isScheduleActive({}, at(1, 10, 0))));
const sch = (o) => ({ blocking: { schedule: Object.assign({ enabled: true }, o) } });
t('schedule: weekday work hours', () => {
  const s = sch({});
  assert(B.isScheduleActive(s, at(1, 9, 0))); assert(B.isScheduleActive(s, at(5, 17, 59)));
  assert(!B.isScheduleActive(s, at(1, 8, 59))); assert(!B.isScheduleActive(s, at(1, 18, 0)));
  assert(!B.isScheduleActive(s, at(0, 12, 0))); assert(!B.isScheduleActive(s, at(6, 12, 0)));
});
t('schedule: overnight range', () => {
  const s = sch({ start: '22:00', end: '06:00', days: [1] }); // started Monday night
  assert(B.isScheduleActive(s, at(1, 23, 0))); assert(B.isScheduleActive(s, at(2, 5, 0)));
  assert(!B.isScheduleActive(s, at(1, 5, 0))); assert(!B.isScheduleActive(s, at(2, 23, 0)));
});
console.log(`\n${n} tests passed`);
