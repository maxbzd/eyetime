// Dependency-free sanity checks: JSON validity, JS syntax, manifest file references, locales.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const skip = new Set(['.git', 'node_modules', 'scripts-dev', '.github']);
let errors = 0;
const fail = m => { console.error('✗ ' + m); errors++; };
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (skip.has(f)) continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) { try { cp.execFileSync('node', ['--check', p], { stdio: 'pipe' }); } catch (e) { fail('syntax: ' + path.relative(root, p)); } }
    else if (f.endsWith('.json') && f !== 'eyetime_database.json') { try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { fail('json: ' + path.relative(root, p)); } }
  }
})(root);
const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const refs = [m.background?.service_worker, m.chrome_url_overrides?.newtab, m.action?.default_popup, m.options_page,
  ...(m.content_scripts || []).flatMap(c => [...(c.js || []), ...(c.css || [])]), ...Object.values(m.icons || {})].filter(Boolean);
refs.forEach(r => { if (!fs.existsSync(path.join(root, r))) fail('manifest references missing file: ' + r); });
if (m.default_locale && !fs.existsSync(path.join(root, '_locales', m.default_locale, 'messages.json'))) fail('missing default locale');
if (errors) process.exit(1);
console.log('✓ all checks passed');
