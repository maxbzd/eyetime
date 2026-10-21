// Prepares site/assets (screenshots + logo) and regenerates the body of site/privacy.html from PRIVACY.md,
// so the published policy can never drift from the repository. Run by the Pages workflow; also handy locally.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site/assets');
fs.mkdirSync(out, { recursive: true });
for (const f of ['1-home.png', '2-focus.png', '3-insights.png', '4-home-dark.png', '7-looks.png', '11-palette.png', '12-timeline.png', '13-week-card.png']) fs.copyFileSync(path.join(root, 'store/screenshots', f), path.join(out, f));
fs.copyFileSync(path.join(root, 'icons/logo.svg'), path.join(out, 'logo.svg'));
fs.copyFileSync(path.join(root, 'store/demo.mp4'), path.join(out, 'demo.mp4'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/&lt;(https?:\/\/[^&]+)&gt;/g, '<a href="$1">$1</a>').replace(/\*(.+?)\*/g, '<em>$1</em>');
const lines = fs.readFileSync(path.join(root, 'PRIVACY.md'), 'utf8').split('\n');
const html = []; let list = false;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('|')) {
    const rows = [];
    for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    i--;
    html.push('<table><thead><tr>' + rows[0].map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>', ...rows.slice(2).map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>'), '</tbody></table>');
    continue;
  }
  if (l.startsWith('- ')) { if (!list) { html.push('<ul>'); list = true; } html.push(`<li>${inline(l.slice(2))}</li>`); continue; }
  if (list) { html.push('</ul>'); list = false; }
  if (l.startsWith('# ')) html.push(`<h1>${inline(l.slice(2))}</h1>`);
  else if (l.startsWith('## ')) html.push(`<h2>${inline(l.slice(3))}</h2>`);
  else if (l.trim()) html.push(`<p>${inline(l)}</p>`);
}
if (list) html.push('</ul>');
const file = path.join(root, 'site/privacy.html');
const page = fs.readFileSync(file, 'utf8').replace(/(<main class="doc">)[\s\S]*(<\/main>)/, `$1\n${html.join('\n')}\n  $2`);
fs.writeFileSync(file, page);
console.log('site ready');
