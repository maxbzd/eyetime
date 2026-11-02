// The wallpaper of the moments (pause page, eye break, onboarding): the same photo of the day as the new tab, behind a soft veil.
// Only in the Calm look (the others keep their own colour); `body.has-wall` switches the page to white-on-photo (see wall.css).

import { FRAMES, framePaths, dailyFrame } from '../shared/frames.js';
import { dayKey } from '../shared/time.js';

const look = document.documentElement.getAttribute('data-look');
if (!look || look === 'calm') {
  let skip = 0; // "another photo" on the new tab is kept for the day; the other pages show the same one
  try { const v = JSON.parse(localStorage.getItem('et-wall-skip') || 'null'); if (v && v.day === dayKey()) skip = v.n; } catch { /* private mode */ }
  const id = dailyFrame(new Date(), skip);
  if (FRAMES[id]) {
    const img = new Image();
    const url = chrome.runtime.getURL(framePaths(id).photo);
    img.onload = () => { document.documentElement.style.setProperty('--wall', `url(${url})`); document.body.classList.add('has-wall'); };
    img.src = url;
  }
}
