// Builds store packages in dist/:  eyetime-chrome.zip (Chrome + Edge) and eyetime-firefox.zip (Firefox AMO). Needs the `zip` CLI.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const items = ['manifest.json', 'background.js', '_locales', 'assets', 'block', 'content', 'dashboard', 'icons', 'newtab', 'onboarding', 'options', 'popup', 'styles'];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
fs.rmSync(dist, { recursive: true, force: true });

function build(name, transform) {
  const dir = path.join(dist, name);
  fs.mkdirSync(dir, { recursive: true });
  items.filter(i => i !== 'manifest.json').forEach(i => fs.cpSync(path.join(root, i), path.join(dir, i), { recursive: true }));
  const m = transform(JSON.parse(JSON.stringify(manifest)));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 2));
  cp.execSync(`zip -rq ../${name}.zip .`, { cwd: dir });
  console.log(`✓ dist/${name}.zip`);
}

build('eyetime-chrome', m => m);
build('eyetime-firefox', m => {
  m.background = { scripts: ['assets/i18n_en.js', 'assets/i18n.js', 'assets/blocking.js', 'assets/report.js', 'background.js'] };
  m.host_permissions = [...new Set([...m.host_permissions, 'http://*/*', 'https://*/*'])];
  m.browser_specific_settings = {
    gecko: { id: 'eyetime@maxbzd.github.io', strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } },
    gecko_android: { strict_min_version: '142.0' }
  };
  return m;
});
