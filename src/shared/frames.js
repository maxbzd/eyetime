// The photographs that ship with EyeTime ("Frames"): each is a photo, optionally a mask of its foreground (so the clock can sit between them), and a few facts about it (pure).
// The files live in src/newtab/frames/<id>.webp and <id>-fg.webp. The photos are from Unsplash (Unsplash License: free to use, no attribution required); the credits are in docs/PHOTO-CREDITS.md.

/** `tone`: the text colour that reads on it (light text on a dark photo); `mask`: a foreground mask exists; `shade`: how much the photo is darkened under the text, 0..1. */
export const FRAMES = {
  peak:   { tone: 'light', mask: true,  shade: 0.10, credit: 'Tyler Lastovich' },
  pines:  { tone: 'light', mask: false,  shade: 0.00, credit: 'Michael Constantin P.' },
  mirror: { tone: 'light', mask: false,  shade: 0.00, credit: 'Maria Budanova' },
  road:   { tone: 'light', mask: false, shade: 0.00, credit: 'Valery Sysoev' },
  solo:   { tone: 'dark',  mask: true,  shade: 0.00, credit: 'Patti Black' },
  shore:  { tone: 'dark',  mask: true,  shade: 0.00, credit: 'Gantas Vaičiulėnas' },
  alpen:  { tone: 'light', mask: true,  shade: 0.12, credit: 'Isaac Maffeis' },
  haze:   { tone: 'dark',  mask: true,  shade: 0.00, credit: 'Patrick Hendry' },
  // the wallpapers of Home · Today (CC0, from Unsplash via Wikimedia Commons): calm, colour, room in the middle for the clock
  aurum:    { tone: 'light', mask: false, shade: 0.18, credit: 'Jeremy Bishop', veil: [0.53, 0.47, 0.0], wall: true },
  dunes:    { tone: 'light', mask: false, shade: 0.06, credit: 'Joe Mania', veil: [0.06, 0.49, 0.0], wall: true },
  mauve:    { tone: 'light', mask: false, shade: 0.20, credit: 'Charles Yeager', veil: [0.51, 0.49, 0.0], wall: true },
  blue:     { tone: 'light', mask: false, shade: 0.10, credit: 'Alex Shutin', veil: [0.08, 0.45, 0.0], wall: true },
  still:    { tone: 'light', mask: false, shade: 0.06, credit: 'Jingwei Ke', veil: [0.0, 0.16, 0.0], wall: true },
  vista:    { tone: 'light', mask: false, shade: 0.10, credit: 'Markus Spiske', veil: [0.37, 0.0, 0.0], wall: true },
  coast:    { tone: 'light', mask: false, shade: 0.14, credit: 'Grace Caadiang', veil: [0.29, 0.29, 0.0], wall: true },
  cloudsea: { tone: 'light', mask: false, shade: 0.10, credit: 'Liu Qiaojun', veil: [0.25, 0.41, 0.0], wall: true },
  above:    { tone: 'light', mask: false, shade: 0.12, credit: 'Liane Metzler', veil: [0.38, 0.33, 0.04], wall: true },
  pier:     { tone: 'light', mask: false, shade: 0.06, credit: 'Paul Carmona', veil: [0.17, 0.0, 0.0], wall: true },
  blush:    { tone: 'light', mask: false, shade: 0.18, credit: 'Ferdinand Stöhr', veil: [0, 0, 0.06], wall: true },
  rose:     { tone: 'light', mask: false, shade: 0.20, credit: 'Sebastien Hamel', veil: [0.33, 0.26, 0.1], wall: true },
  dusk:     { tone: 'light', mask: false, shade: 0.00, credit: 'Stephen Pedersen', veil: [0, 0, 0], wall: true },
  sand:     { tone: 'light', mask: false, shade: 0.22, credit: 'Keith Hardy', veil: [0.13, 0.49, 0.0], wall: true },
};
export const FRAME_IDS = Object.keys(FRAMES);
/** The wallpapers, in the order they take turns day by day. */
/** How much darker the veil is over a wallpaper (centre, top, bottom, 0..1), so white type keeps its contrast; measured by scripts-dev/e2e/wall-contrast.cjs. */
export const wallVeil = (id) => (FRAMES[id] && FRAMES[id].veil) || [0, 0, 0];
export const WALL_IDS = Object.keys(FRAMES).filter((id) => FRAMES[id].wall);
/** `newtab.frame = 'daily'`: a different wallpaper every day (and `skip` more for "next photo"). */
export const DAILY = 'daily';
export function dailyFrame(date = new Date(), skip = 0) {
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000);
  const n = WALL_IDS.length;
  return WALL_IDS[(((day + skip) % n) + n) % n];
}
/** A saved frame id, or '' when it is not one of ours. */
export const normalizeFrame = (v) => (typeof v === 'string' && Object.hasOwn(FRAMES, v) ? v : '');
/** Paths of a frame's files, relative to the extension root. */
export const framePaths = (id) => ({ photo: `src/newtab/frames/${id}.webp`, mask: FRAMES[id].mask ? `src/newtab/frames/${id}-fg.webp` : '' });
