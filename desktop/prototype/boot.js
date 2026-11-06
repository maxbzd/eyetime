// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
/* Runs first: the queue that holds calls made before bridge.js loads (moved out of home.html so that the page needs no inline script). */
window.ETB = window.__TAURI__ ? { q: [], push(k, v) { this.q.push([k, v]); } } : undefined;
