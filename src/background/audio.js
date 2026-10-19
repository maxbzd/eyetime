// Plays 'start' / 'end' sounds through an offscreen document (Chrome). On browsers without the
// offscreen API (Firefox) sound is simply skipped; the system notification sound still plays.

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

export async function playChime(kind) {
  try {
    if (!(await ensureOffscreen())) return;
    await chrome.runtime.sendMessage({ target: 'offscreen', kind });
  } catch { /* sound is a nicety, never an error */ }
}

/** Ambient focus sound (synthesised in the offscreen document): 'brown' | 'rain' | 'cafe', or 'off'. */
export async function setAmbient(kind) {
  try {
    if (kind === 'off') { if (chrome.offscreen && (await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] }))?.length) await chrome.runtime.sendMessage({ target: 'offscreen', kind: 'ambient-stop' }); return; }
    if (!(await ensureOffscreen())) return;
    await chrome.runtime.sendMessage({ target: 'offscreen', kind: 'ambient-start', sound: kind });
  } catch { /* sound is a nicety, never an error */ }
}
