// Test helper: launches Chromium with the extension and maps EVERY hostname to a local server,
// so youtube.com, github.com … resolve offline and the real block/track flows can be exercised.
// Requires Playwright (npm i -D playwright, or set PLAYWRIGHT_PATH) and Chromium (channel 'chromium').
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); }
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const path = require('path');
const EXT = process.env.EXT || path.join(__dirname, '../..'); // folder with manifest.json (repo root or dist/chrome)
const PORT = 8099;

/**
 * One port, two protocols: plain http AND https with a throw-away self-signed certificate. Chromium upgrades http:// to https://
 * for HSTS-preloaded domains (github.com, youtube.com …) and in newer versions by default, so the fake sites must answer both.
 */
function server() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-cert-'));
  cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-subj', '/CN=localhost', '-days', '2'], { stdio: 'ignore' });
  const handler = (req, rsp) => {
    rsp.setHeader('content-type', 'text/html');
    rsp.end(`<!doctype html><title>${req.headers.host}</title><body style="font:20px sans-serif;padding:40px"><h1>Fake site: ${req.headers.host}</h1><p>path ${req.url}</p></body>`);
  };
  const plain = http.createServer(handler);
  const secure = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) }, handler);
  return new Promise((res) => {
    const s = net.createServer((socket) => {
      socket.once('data', (buf) => { socket.pause(); socket.unshift(buf); (buf[0] === 0x16 ? secure : plain).emit('connection', socket); socket.resume(); }); // 0x16 = TLS handshake
      socket.on('error', () => {});
    }).listen(PORT, '127.0.0.1', () => res(s));
  });
}

async function launch(opts = {}) {
  const srv = await server();
  const ctx = await chromium.launchPersistentContext('/tmp/pw-profile-' + Date.now() + Math.random().toString(36).slice(2), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost`,
      // newer Chromium upgrades http:// to https:// by default; the fake local server only speaks http
      '--ignore-certificate-errors', '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,HttpsFirstModeV2ForEngagedSites,HttpsFirstModeIncognito,HttpsFirstModeV2,HttpsFirstBalancedMode'],
    viewport: opts.viewport || { width: 1280, height: 800 }, colorScheme: opts.colorScheme || 'light',
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const id = sw.url().split('/')[2];
  for (let i = 0; i < 40; i++) { if (await sw.evaluate(() => typeof chrome.storage !== 'undefined').catch(() => false)) break; await new Promise(r => setTimeout(r, 250)); }
  const close = async () => { await ctx.close(); srv.close(); };
  return { ctx, sw, id, close, url: (h, p = '/') => `http://${h}:${PORT}${p}` };
}
module.exports = { launch, PORT };
