// Rain and snow over the background, only when the person asked for it and the weather where they are says so.
// Rain is "rain on glass": beads of water on a pane that show the photo upside down (like real drops), a few of them run down and leave a wet line.
// Snow is soft flakes at three depths. Everything is drawn on one canvas behind the page; it stops when the tab is hidden and stays still for reduced motion.

const FRAME_MS = 33; // about 30 frames a second is plenty for slow weather

/** @typedef {{ x: number, y: number, r: number, vy: number, run: boolean, wait: number, trail: Array<[number, number]> }} Drop */
/** @typedef {{ x: number, y: number, r: number, z: number, ph: number }} Flake */

export function mountWeatherFx() {
  /** @type {HTMLCanvasElement | null} */ let canvas = null;
  /** @type {CanvasRenderingContext2D | null} */ let ctx = null;
  /** @type {HTMLCanvasElement | null} */ let scene = null;
  let img = null, photoSrc = '', want = /** @type {{ fx: 'rain' | 'snow', power: number } | null} */ (null);
  let W = 0, H = 0, raf = 0, last = 0, shown = '', setSeq = 0;
  /** @type {Drop[]} */ let drops = [];
  /** @type {Flake[]} */ let flakes = [];
  let streaks = /** @type {Array<{ x: number, y: number, l: number, v: number }>} */ ([]);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lightOnDark = () => document.body.dataset.tone === 'dark'; // a dark scene: light weather reads, else a dark one

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas'); canvas.className = 'wx-fx'; canvas.setAttribute('aria-hidden', 'true');
    const bg = document.querySelector('.bg');
    if (bg) bg.after(canvas); else document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVisible);
  }
  function removeCanvas() {
    window.cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVisible);
    canvas?.remove(); canvas = null; ctx = null; scene = null; drops = []; flakes = []; streaks = [];
  }

  /** The photo as it is on the page (cover, centred), drawn once at screen size: the drops sample it. */
  function paintScene() {
    scene = null;
    if (!img || !W) return;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), k = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    scene = c;
  }

  function seed() {
    if (!canvas || !ctx || !want) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScene();
    const area = W * H, p = want.power;
    drops = []; flakes = []; streaks = [];
    if (want.fx === 'rain') {
      const n = Math.round(area / 7500 * p);
      for (let i = 0; i < n; i++) drops.push(newDrop(true));
      for (let i = 0; i < Math.round(26 * p); i++) streaks.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(14, 30), v: rnd(16, 26) });
    } else {
      const n = Math.round(area / 6000 * p);
      for (let i = 0; i < n; i++) { const z = Math.pow(Math.random(), 1.6); flakes.push({ x: rnd(0, W), y: rnd(0, H), r: 1.1 + z * 3.6, z, ph: rnd(0, 6.28) }); }
    }
  }

  /** @returns {Drop} */
  function newDrop(anywhere) {
    const r = 1.3 + Math.pow(Math.random(), 2.6) * 9.5;
    return { x: rnd(0, W), y: anywhere ? rnd(0, H) : rnd(-20, H * 0.25), r, vy: 0, run: false, wait: r > 5 ? Math.round(rnd(60, 900)) : 1e9, trail: [] };
  }

  function drawDrop(d) {
    const g = /** @type {CanvasRenderingContext2D} */ (ctx), { x, y, r } = d, rx = r * 0.86, ry = r * 1.04;
    if (r > 3) { // the little shadow the bead throws on the pane
      const sh = g.createRadialGradient(x + r * 0.2, y + r * 0.5, r * 0.3, x + r * 0.2, y + r * 0.5, r * 1.7);
      sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.fillRect(x - r * 2, y - r * 2, r * 4.4, r * 4.9);
    }
    g.save();
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.clip();
    if (scene && r > 2) { // a drop is a small lens: it shows the wider picture upside down, a little more vivid
      const s = r * 6.4;
      g.save(); g.translate(x, y); g.scale(-1, -1);
      g.filter = 'saturate(1.25) contrast(1.08)';
      g.drawImage(scene, Math.max(0, Math.min(W - s, x - s / 2)), Math.max(0, Math.min(H - s, y - s / 2)), s, s, -rx, -ry, rx * 2, ry * 2);
      g.restore();
    } else { g.fillStyle = lightOnDark() ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.30)'; g.fillRect(x - rx, y - ry, rx * 2, ry * 2); }
    const edge = g.createRadialGradient(x, y, Math.min(rx, ry) * .45, x, y, Math.max(rx, ry) * 1.02); // thick glass at the rim: a dark ring
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(.72, 'rgba(0,0,0,.10)'); edge.addColorStop(1, 'rgba(0,0,0,.46)');
    g.fillStyle = edge; g.fillRect(x - rx - 1, y - ry - 1, rx * 2 + 2, ry * 2 + 2);
    const light = g.createRadialGradient(x, y + ry * .78, 0, x, y + ry * .78, r * 1.1); // light gathered at the bottom of the bead
    light.addColorStop(0, 'rgba(255,255,255,.42)'); light.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = light; g.fillRect(x - rx, y, rx * 2, ry);
    g.restore();
    g.lineWidth = Math.max(.5, r * .06); g.strokeStyle = 'rgba(255,255,255,.30)';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.92)'; // the window's reflection
    g.beginPath(); g.ellipse(x - rx * .36, y - ry * .5, Math.max(.6, r * .2), Math.max(.5, r * .12), -.55, 0, Math.PI * 2); g.fill();
  }

  function stepRain(animate) {
    const g = /** @type {CanvasRenderingContext2D} */ (ctx);
    g.clearRect(0, 0, W, H);
    const dark = lightOnDark();
    if (animate && want && want.power >= 1) { // far rain: faint slanted lines
      g.lineWidth = 1; g.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(40,64,96,.14)'; g.beginPath();
      for (const s of streaks) { g.moveTo(s.x, s.y); g.lineTo(s.x - s.l * .16, s.y + s.l); s.y += s.v; s.x -= s.v * .16; if (s.y > H + 30 || s.x < -30) { s.y = rnd(-60, -10); s.x = rnd(0, W + 80); } }
      g.stroke();
    }
    for (const d of drops) {
      if (animate) {
        if (!d.run && --d.wait <= 0) { d.run = true; d.vy = .3; }
        if (d.run) {
          if (Math.random() < .015) d.vy = 0.05; // a drop hesitates, then goes on
          d.vy = Math.min(d.vy + .035 + d.r * .004, 2.2 + d.r * .25);
          d.y += d.vy; d.x += rnd(-.12, .12); d.r -= d.vy * .0035;
          if (d.trail.length === 0 || d.y - d.trail[d.trail.length - 1][1] > 3) { d.trail.push([d.x, d.y]); if (d.trail.length > 38) d.trail.shift(); }
          if (d.r < 3.4) { d.run = false; d.wait = Math.round(rnd(400, 1600)); d.trail.length = 0; } // too small to run: it stays as a bead
          if (d.y > H + 20) Object.assign(d, newDrop(false));
        }
      }
      if (d.trail.length > 1) { // the wet line a running drop leaves
        g.lineWidth = Math.max(1, d.r * .55); g.lineCap = 'round'; g.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.16)';
        g.beginPath(); g.moveTo(d.trail[0][0], d.trail[0][1]); for (const p of d.trail) g.lineTo(p[0], p[1]); g.stroke();
      }
      drawDrop(d);
    }
  }

  function stepSnow(animate) {
    const g = /** @type {CanvasRenderingContext2D} */ (ctx);
    g.clearRect(0, 0, W, H);
    const dark = lightOnDark();
    for (const f of flakes) {
      if (animate) {
        f.y += .35 + f.z * 1.5; f.ph += .012 + f.z * .01; f.x += Math.sin(f.ph) * (.25 + f.z * .5);
        if (f.y > H + 6) { f.y = -6; f.x = rnd(0, W); } if (f.x > W + 6) f.x = -6; if (f.x < -6) f.x = W + 6;
      }
      const a = .35 + f.z * .6;
      if (!dark) { g.fillStyle = `rgba(60,84,120,${(a * .16).toFixed(3)})`; g.beginPath(); g.arc(f.x + .6, f.y + .8, f.r * 1.15, 0, 6.3); g.fill(); } // on a light picture a soft shade keeps white flakes visible
      const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.4);
      gr.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`); gr.addColorStop(.55, `rgba(255,255,255,${(a * .75).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, f.r * 1.4, 0, 6.3); g.fill();
    }
  }

  function frame(t, force = false) {
    raf = 0;
    if (!canvas || !want || document.hidden) return;
    const animate = !reduce.matches;
    if (animate) raf = window.requestAnimationFrame(frame);
    if (!force && t - last < FRAME_MS) return;
    last = t;
    if (want.fx === 'rain') stepRain(animate); else stepSnow(animate);
  }
  const start = () => { if (!raf && canvas && want && !document.hidden) { raf = window.requestAnimationFrame(frame); } };
  function onResize() { seed(); start(); }
  function onVisible() { if (document.hidden) { window.cancelAnimationFrame(raf); raf = 0; } else start(); }
  reduce.addEventListener?.('change', () => { if (want) { start(); } });

  async function loadPhoto(src) {
    if (src === photoSrc && (img || !src)) return;
    photoSrc = src; img = null;
    if (!src) return;
    try { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); } catch { img = null; }
  }

  return {
    /** Show the effect (`fx` 'rain' | 'snow', `power` 0.5–1.5) or none (fx null). `photo` is the background photo, so drops can show it. */
    async set(fx, power = 1, photo = '') {
      const key = fx ? fx + '|' + power + '|' + photo.length + ':' + photo.slice(-32) : '';
      if (key === shown && (!fx || canvas)) return; // nothing changed: keep the drops where they are
      shown = key;
      const mine = ++setSeq;
      await loadPhoto(photo);
      if (mine !== setSeq) return; // a newer call took over while the photo was loading
      if (!fx) { want = null; removeCanvas(); return; }
      want = { fx, power };
      ensureCanvas(); seed(); start();
      if (reduce.matches) frame(0, true); // a still picture
    },
    active: () => !!want,
  };
}
