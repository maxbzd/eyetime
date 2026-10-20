// Plays 'start' / 'end' sounds and the ambient focus sound. Chrome: through an offscreen document (service workers have no
// Web Audio). Firefox: its background is an event page with Web Audio, so the same synthesis code is called directly.

const DOC_URL = 'src/background/offscreen.html';

async function ensureOffscreen() {
  if (!chrome.offscreen) return false;
  const existing = await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing && existing.length) return true;
  try {
    await chrome.offscreen.createDocument({ url: DOC_URL, reasons: ['AUDIO_PLAYBACK'], justification: 'Soft sounds when a focus session starts or ends, and optional ambient sound while it runs' });
    await new Promise((r) => setTimeout(r, 200)); // let the document register its listener
    return true;
  } catch { return false; }
}

/** No offscreen API but a Web Audio capable background (Firefox): run the audio code in this context. */
async function direct(msg) {
  if (chrome.offscreen || typeof AudioContext === 'undefined') return false;
  (await import('./offscreen.js')).handle(msg);
  return true;
}

export async function playChime(kind) {
  try {
    if (await direct({ target: 'offscreen', kind })) return;
    if (!(await ensureOffscreen())) return;
    await chrome.runtime.sendMessage({ target: 'offscreen', kind });
  } catch { /* sound is a nicety, never an error */ }
}

/** Ambient focus sound (synthesised in the offscreen document): 'brown' | 'rain' | 'cafe', or 'off'. */
export async function setAmbient(kind) {
  try {
    if (await direct(kind === 'off' ? { target: 'offscreen', kind: 'ambient-stop' } : { target: 'offscreen', kind: 'ambient-start', sound: kind })) return;
    if (kind === 'off') { if (chrome.offscreen && (await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] }))?.length) await chrome.runtime.sendMessage({ target: 'offscreen', kind: 'ambient-stop' }); return; }
    if (!(await ensureOffscreen())) return;
    await chrome.runtime.sendMessage({ target: 'offscreen', kind: 'ambient-start', sound: kind });
  } catch { /* sound is a nicety, never an error */ }
}
