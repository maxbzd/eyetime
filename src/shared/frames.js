// The photographs that ship with EyeTime ("Frames"): each is a photo, optionally a mask of its foreground (so the clock can sit between them), and a few facts about it (pure).
// The files live in src/newtab/frames/<id>.webp and <id>-fg.webp. The photos are from Unsplash (Unsplash License: free to use, no attribution required); the credits are in docs/PHOTO-CREDITS.md.

/** `tone`: the text colour that reads on it (light text on a dark photo); `mask`: a foreground mask exists; `shade`: how much the photo is darkened under the text, 0..1. */
export const FRAMES = {
  peak:   { tone: 'light', mask: true,  shade: 0.10, credit: 'Tyler Lastovich' },
  pines:  { tone: 'light', mask: true,  shade: 0.00, credit: 'Michael Constantin P.' },
  mirror: { tone: 'light', mask: false,  shade: 0.00, credit: 'Maria Budanova' },
  road:   { tone: 'light', mask: false, shade: 0.00, credit: 'Valery Sysoev' },
  solo:   { tone: 'dark',  mask: true,  shade: 0.00, credit: 'Patti Black' },
  shore:  { tone: 'dark',  mask: true,  shade: 0.00, credit: 'Gantas Vaičiulėnas' },
  alpen:  { tone: 'light', mask: true,  shade: 0.12, credit: 'Isaac Maffeis' },
  haze:   { tone: 'dark',  mask: true,  shade: 0.00, credit: 'Patrick Hendry' },
};
export const FRAME_IDS = Object.keys(FRAMES);
/** A saved frame id, or '' when it is not one of ours. */
export const normalizeFrame = (v) => (typeof v === 'string' && Object.hasOwn(FRAMES, v) ? v : '');
/** Paths of a frame's files, relative to the extension root. */
export const framePaths = (id) => ({ photo: `src/newtab/frames/${id}.webp`, mask: FRAMES[id].mask ? `src/newtab/frames/${id}-fg.webp` : '' });
