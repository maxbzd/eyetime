// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Page -> service worker calls.

/** send('focus:start', { minutes: 25 }) -> response from src/background/messages.js */
export function send(type, data = {}) {
  return chrome.runtime.sendMessage({ type, ...data }).catch(() => ({ ok: false, error: 'worker-unavailable' }));
}

export const openPage = (path) => chrome.tabs.create({ url: chrome.runtime.getURL(path) });
