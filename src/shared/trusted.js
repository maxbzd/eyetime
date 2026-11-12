// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Trusted Types for the extension's pages (the manifest's policy says `require-trusted-types-for 'script'` and names this one policy): the places where a string would become
// running code are refused by the browser unless the string came through a policy. The only such place is the start of a worker from the extension's own files, and the
// policy lets through exactly that: an address inside this extension. Everything else (innerHTML, eval, script.src with a string) has no policy and cannot happen.

/** @type {{ createScriptURL(u: string): any } | null} */
let policy = null;
try {
  const tt = /** @type {any} */ (globalThis).trustedTypes;
  if (tt && tt.createPolicy) {
    policy = tt.createPolicy('eyetime', {
      createScriptURL: (/** @type {string} */ u) => {
        const own = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('') : '';
        if (!own || !String(u).startsWith(own)) throw new TypeError('not a file of this extension');
        return u;
      },
    });
  }
} catch { /* no Trusted Types here (a test, an older browser), or the policy was made already: strings are accepted as they always were */ }

/** An address of one of this extension's own scripts, in the form `new Worker()` takes where Trusted Types are on. */
export const ownScriptUrl = (/** @type {string} */ u) => (policy ? policy.createScriptURL(u) : u);
