// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The usage of the days as CSV for a spreadsheet (Insights → Export). Pure: the days and the classifier come in, the text goes out.
import { csvCell } from './taskio.js';

/** What a spreadsheet needs to show UTF-8 right (Excel reads a file without it as an old code page, and every non-Latin name turns to noise). */
export const CSV_BOM = '\uFEFF';

/**
 * One row per site or app per day. The first entry of a day wins when ranges overlap; a day without data is skipped. Every text cell goes through `csvCell`:
 * quoted when it holds a comma, a quote or a line break, and made text when it would be a formula (= + - @), because an app name comes from outside.
 * @param {[string, any][]} entries `[dayKey, day]` pairs
 * @param {(host: string) => string} classify
 */
export function usageCsv(entries, classify) {
  const lines = [['date', 'domain', 'seconds', 'class'].join(',')];
  const seen = new Set();
  for (const [key, d] of entries) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (!d) continue;
    for (const [host, sec] of Object.entries(d.d || {})) lines.push([key, host, Number(sec) || 0, classify(host)].map(csvCell).join(','));
    for (const [app, sec] of Object.entries(d.a || {})) lines.push([key, app, Number(sec) || 0, 'app'].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}
