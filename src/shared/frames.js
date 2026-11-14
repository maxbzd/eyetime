// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
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
  // more wallpapers (CC0, from Unsplash via Wikimedia Commons), in the order they take turns after the ones above
  amber:     { tone: 'light', mask: false, shade: 0.08, credit: 'freestocks.org', veil: [0, 0, 0], wall: true },
  seamist:   { tone: 'light', mask: false, shade: 0.08, credit: 'Good Free Photos', veil: [0.12, 0.3, 0], wall: true },
  peach:     { tone: 'light', mask: false, shade: 0.08, credit: 'Joe deSousa', veil: [0, 0.32, 0.1], wall: true },
  violet:    { tone: 'light', mask: false, shade: 0.08, credit: 'Heejing KIM', veil: [0.04, 0, 0], wall: true },
  apricot:   { tone: 'light', mask: false, shade: 0.08, credit: 'Ant Rozetsky', veil: [0.08, 0, 0.24], wall: true },
  plum:      { tone: 'light', mask: false, shade: 0.08, credit: 'Jeremy Bishop', veil: [0, 0, 0.18], wall: true },
  lakerose:  { tone: 'light', mask: false, shade: 0.08, credit: 'Davide Ragusa', veil: [0.28, 0, 0], wall: true },
  silk:      { tone: 'light', mask: false, shade: 0.08, credit: 'Stefan Kunze', veil: [0.24, 0.04, 0], wall: true },
  ember:     { tone: 'light', mask: false, shade: 0.08, credit: 'Jason Blackeye', veil: [0, 0, 0], wall: true },
  teal:      { tone: 'light', mask: false, shade: 0.08, credit: 'Joseph Barrientos', veil: [0.14, 0, 0], wall: true },
  blaze:     { tone: 'light', mask: false, shade: 0.08, credit: 'Christian Seeling', veil: [0, 0, 0], wall: true },
  coral:     { tone: 'light', mask: false, shade: 0.08, credit: 'Robert Katzki', veil: [0.02, 0.2, 0], wall: true },
  valley:    { tone: 'light', mask: false, shade: 0.08, credit: 'Neven Krcmarek', veil: [0, 0.44, 0], wall: true },
  autumnhaze:  { tone: 'light', mask: false, shade: 0.08, credit: 'Elke Bürgin', veil: [0, 0.4, 0], wall: true },
  mistpeak:  { tone: 'light', mask: false, shade: 0.08, credit: 'Tatyana Gavrilova', veil: [0.32, 0.14, 0], wall: true },
  pinemist:  { tone: 'light', mask: false, shade: 0.08, credit: 'Paul Gilmore', veil: [0.18, 0.34, 0], wall: true },
  rollcloud:  { tone: 'light', mask: false, shade: 0.08, credit: 'Joshua Sortino', veil: [0.28, 0.48, 0], wall: true },
  bluevalley:  { tone: 'light', mask: false, shade: 0.08, credit: 'Ricardo Gomez Angel', veil: [0.26, 0, 0], wall: true },
  goldcloud:  { tone: 'light', mask: false, shade: 0.08, credit: 'Filip Varga', veil: [0.26, 0.46, 0], wall: true },
  cloudblue:  { tone: 'light', mask: false, shade: 0.08, credit: 'Yousif Malibiran', veil: [0.22, 0.34, 0], wall: true },
  peakscloud:  { tone: 'light', mask: false, shade: 0.08, credit: 'Kai Oberhäuser', veil: [0.28, 0, 0.28], wall: true },
  pinkdawn:  { tone: 'light', mask: false, shade: 0.08, credit: 'Alexandre Godreau', veil: [0.24, 0.36, 0], wall: true },
  farshore:  { tone: 'light', mask: false, shade: 0.08, credit: 'Jesse Orrico', veil: [0.2, 0.04, 0], wall: true },
  island:    { tone: 'light', mask: false, shade: 0.08, credit: 'Azrul Aziz', veil: [0.04, 0.3, 0], wall: true },
  calmrock:  { tone: 'light', mask: false, shade: 0.08, credit: 'Jeremy Bishop', veil: [0.2, 0.44, 0], wall: true },
  tealshore:  { tone: 'light', mask: false, shade: 0.08, credit: 'Matthew Kane', veil: [0.18, 0.4, 0], wall: true },
  turq:      { tone: 'light', mask: false, shade: 0.08, credit: 'Mathyas Kurmann', veil: [0.3, 0.42, 0], wall: true },
  quiet:     { tone: 'light', mask: false, shade: 0.08, credit: 'Jon Flobrant', veil: [0.12, 0.36, 0], wall: true },
  goldmirror:  { tone: 'light', mask: false, shade: 0.08, credit: 'Johannes Plenio', veil: [0, 0.42, 0], wall: true },
  auroragreen:  { tone: 'light', mask: false, shade: 0.0, credit: 'Paul Morris', veil: [0.24, 0, 0], wall: true },
  milkyway:  { tone: 'light', mask: false, shade: 0.0, credit: 'Kristopher Roller', veil: [0, 0, 0], wall: true },
  violetnight:  { tone: 'light', mask: false, shade: 0.0, credit: 'Vincentiu Solomon', veil: [0, 0, 0], wall: true },
  nightpeaks:  { tone: 'light', mask: false, shade: 0.0, credit: 'Mukesh Jain', veil: [0, 0, 0], wall: true },
  aurorapines:  { tone: 'light', mask: false, shade: 0.0, credit: 'Vincent Guth', veil: [0, 0, 0], wall: true },
  autumnaurora:  { tone: 'light', mask: false, shade: 0.0, credit: 'Alan Labisch', veil: [0.18, 0, 0], wall: true },
  horizon:   { tone: 'light', mask: false, shade: 0.0, credit: 'Greg Rakozy', veil: [0.3, 0, 0], wall: true },
  meadow:    { tone: 'light', mask: false, shade: 0.08, credit: 'James Pritchett', veil: [0, 0.18, 0], wall: true },
  wheat:     { tone: 'light', mask: false, shade: 0.08, credit: 'Jonathan M. Hethey', veil: [0.14, 0.16, 0], wall: true },
  lavender:  { tone: 'light', mask: false, shade: 0.08, credit: 'Francis Cheung', veil: [0, 0, 0], wall: true },
  desertsun:  { tone: 'light', mask: false, shade: 0.08, credit: 'Fabian Struwe', veil: [0.06, 0.2, 0], wall: true },
  quietdunes:  { tone: 'light', mask: false, shade: 0.08, credit: 'Timothy Simon', veil: [0.2, 0.32, 0], wall: true },
  rosevolcano:  { tone: 'light', mask: false, shade: 0.0, credit: 'Diego PH', veil: [0.24, 0.36, 0], wall: true },
  purplegrass:  { tone: 'light', mask: false, shade: 0.08, credit: 'Courtney Recker', veil: [0.14, 0.18, 0], wall: true },
  wintervalley:  { tone: 'light', mask: false, shade: 0.08, credit: 'James Donovan', veil: [0.3, 0.38, 0], wall: true },
  glacier:   { tone: 'light', mask: false, shade: 0.08, credit: 'Sudarshan Bhat', veil: [0.14, 0.34, 0], wall: true },
  greenlake:  { tone: 'light', mask: false, shade: 0.08, credit: 'Vlad Shapochnikov', veil: [0, 0, 0.18], wall: true },
  moonpeaks:  { tone: 'light', mask: false, shade: 0.08, credit: 'Xavi Garcia', veil: [0, 0, 0.12], wall: true },
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
