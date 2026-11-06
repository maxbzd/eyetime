// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// One licence for the whole repository, and nothing that says otherwise. Run by check.mjs (npm run check).
//   * LICENSE is the official text of FSL-1.1-ALv2 (nothing before it, nothing changed but the year and the name), NOTICE says what is third-party;
//   * package.json and the Cargo workspace name the same licence;
//   * every source file we wrote has the two header lines (a file copied alone still says whose it is and under what), the third-party and generated ones have none of ours;
//   * the texts a person reads (README, site, store listings, manifests, the About screen) do not call EyeTime "open source" or "MIT": it is source-available.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const bad = [];
const ID = 'SPDX-License-Identifier: FSL-1.1-ALv2';

// 1. the text
const lic = read('LICENSE');
if (!/^# Functional Source License, Version 1\.1, ALv2 Future License\n/.test(lic)) bad.push('LICENSE must be the official FSL-1.1-ALv2 text, starting with its own title');
if (!/\nCopyright 20\d\d \S/.test(lic) || /\$\{/.test(lic)) bad.push('LICENSE: the year and the licensor name must be filled in');
for (const clause of ['### Permitted Purpose', 'A Competing Use', '## Grant of Future License', 'second anniversary', 'Apache License, Version 2.0']) if (!lic.includes(clause)) bad.push(`LICENSE lacks "${clause}": the text was changed`);
if (!fs.existsSync(path.join(root, 'NOTICE')) || !/FSL-1\.1-ALv2/.test(read('NOTICE'))) bad.push('NOTICE is missing or does not name the licence');

// 2. metadata
if (JSON.parse(read('package.json')).license !== 'FSL-1.1-ALv2') bad.push('package.json: "license" must be "FSL-1.1-ALv2"');
if (!/^license = "FSL-1\.1-ALv2"$/m.test(read('desktop/Cargo.toml'))) bad.push('desktop/Cargo.toml: workspace license must be "FSL-1.1-ALv2"');
if (!/License: FSL-1\.1-ALv2/.test(read('desktop/packaging/winget/make.mjs'))) bad.push('the winget manifest names another licence');
if (!/lic\('FSL-1\.1-ALv2'\)/.test(read('scripts-dev/sbom.mjs'))) bad.push('the SBOM names another licence for EyeTime itself');

// 3. headers on what is ours
const files = cp.execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const NOT_OURS = /(^|\/)(vendor|node_modules|dist|\.stryker-tmp|target)\/|\.min\.|brands-all\.js$|\/ort\.|^src\/shared\/locales\/data\/|^desktop\/prototype\/three|package-lock\.json|Cargo\.lock/;
for (const f of files) {
  if (NOT_OURS.test(f) || !/\.(js|mjs|cjs|rs|css|py|sh|ps1|ya?ml|toml)$/.test(f)) continue;
  const head = fs.readFileSync(path.join(root, f), 'utf8').slice(0, 400);
  if (!head.includes(ID) || !/Copyright 20\d\d \S/.test(head)) bad.push(`${f}: no licence header`);
}

// 4. what people read
const PUBLIC = ['README.md', 'README_RU.md', 'site/index.html', 'PRIVACY.md', 'CONTRIBUTING.md', 'docs/PRODUCT.md', ...files.filter((f) => /^store\/listing\//.test(f) || /^_locales\/.*messages\.json$/.test(f) || /^src\/shared\/locales\/[a-z]{2}\.js$/.test(f))];
const CLAIM = /open[- ]source|\(MIT\)|MIT licen[cs]e|MIT-Lizenz|licen[cs]e MIT|licencia MIT|licenza MIT|licencja MIT|ліцензія MIT|лицензия MIT|MIT 许可|MITライセンス|código abierto|código aberto|с открытым кодом|з відкритим кодом|开源|オープンソース/i;
for (const f of PUBLIC) { const m = CLAIM.exec(read(f)); if (m) bad.push(`${f}: says "${m[0]}" (EyeTime is source-available under FSL-1.1-ALv2)`); }

if (bad.length) { console.error('✗ licence check\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('✓ licence check: FSL-1.1-ALv2 in LICENSE, metadata and the headers of every source file');
