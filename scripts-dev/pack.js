// Builds eyetime-extension.zip ready for Chrome Web Store / Edge Add-ons upload (needs the `zip` CLI).
const cp = require('child_process');
const items = ['manifest.json', 'background.js', '_locales', 'assets', 'block', 'content', 'dashboard', 'icons', 'newtab', 'onboarding', 'options', 'popup', 'styles'];
cp.execSync(`rm -f eyetime-extension.zip && zip -rq eyetime-extension.zip ${items.join(' ')}`, { cwd: require('path').join(__dirname, '..'), stdio: 'inherit' });
console.log('✓ eyetime-extension.zip created');
