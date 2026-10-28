// Where the guesses about unknown sites are kept (raw key siteGuess: { host: { c, at } }), on this device only; never part of a backup or sync.
import { getRaw, updateCollection } from './storage.js';
import { normalizeGuess } from './siteguess.js';

export async function loadGuess() { return normalizeGuess((await getRaw('siteGuess')).siteGuess); }
export const saveGuess = (entries) => updateCollection('siteGuess', {}, (cur) => normalizeGuess({ ...normalizeGuess(cur), ...entries }));
export const forgetGuess = () => updateCollection('siteGuess', {}, () => ({}));
