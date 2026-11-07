// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The state of the first session (`obFirst`) is written by three parties that can act in the same moment: the onboarding page, the worker (a stop, the end of the session) and every open new tab.
// Each writes only the fields it owns, as a patch applied under one lock to the value read inside the lock: nobody's write can wipe another's.

import { getRaw, setRaw, withLock } from './storage.js';

/** Merge `patch` into `obFirst` (nothing happens when there is no first session). Returns the new state, or null. */
export const patchObFirst = (/** @type {Record<string, any>} */ patch) => withLock('obFirst', async () => {
  const { obFirst } = await getRaw('obFirst');
  if (!obFirst) return null;
  const next = { ...obFirst, ...patch };
  await setRaw({ obFirst: next });
  return next;
});
