// The person's own photograph and what is made from it (the cut-out subject and the depth map): kept in IndexedDB, not in chrome.storage.local.
//
// Why: they are megabytes of data URL. In chrome.storage.local they shared the 10 MB cap with the whole history, were copied into a change event for every open page
// each time one of them was written, and were read again by every "read everything" (the daily clean-up, a backup). IndexedDB has room for them and none of those costs.
//
//   kinds:  'bg'    the photo (data URL)                       (formerly the storage key newtabBg)
//           'fg'    its cut-out subject (PNG data URL)          (newtabFg)
//           'depth' { key, png }: the depth map and the key of the photo it was made from   (newtabDepth)
//
// A photo that an earlier version left in chrome.storage.local is moved here the first time it is read (and removed from there), so nothing is lost on update.
// IndexedDB has no change events across pages, so every write also bumps `photoRev` in chrome.storage.local; pages listen to that key.

const LEGACY = { bg: 'newtabBg', fg: 'newtabFg', depth: 'newtabDepth' };
export const PHOTO_KINDS = Object.keys(LEGACY);
export const REV_KEY = 'photoRev';
const DB_NAME = 'eyetime-photos', STORE = 'photos';

/** @typedef {{ get(k: string): Promise<any>, set(k: string, v: any): Promise<void>, del(ks: string[]): Promise<void>, clear(): Promise<void> }} PhotoBackend */

/** @returns {PhotoBackend} */
export function idbBackend() {
  /** @type {Promise<IDBDatabase> | null} */ let opened = null;
  const open = () => (opened ||= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => { r.result.onclose = () => { opened = null; }; resolve(r.result); };
    r.onerror = () => { opened = null; reject(r.error); };
  }));
  const run = async (/** @type {IDBTransactionMode} */ mode, /** @type {(s: IDBObjectStore) => IDBRequest | void} */ fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode); const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k)),
    set: async (k, v) => { await run('readwrite', (s) => s.put(v, k)); },
    del: async (ks) => { await run('readwrite', (s) => { for (const k of ks) s.delete(k); }); },
    clear: async () => { await run('readwrite', (s) => s.clear()); },
  };
}

/**
 * @param {PhotoBackend} [backend] IndexedDB by default; a test hands in a Map
 * @param {{ get(keys: any): Promise<any>, set(o: any): Promise<void>, remove(keys: any): Promise<void> }} [local] chrome.storage.local by default
 */
export function makePhotos(backend, local) {
  const be = backend || idbBackend();
  const area = () => local || chrome.storage.local;
  const bump = () => area().set({ [REV_KEY]: Date.now() });
  const check = (/** @type {string} */ kind) => { if (!(kind in LEGACY)) throw new Error('unknown photo kind: ' + kind); };

  async function getPhoto(/** @type {string} */ kind) {
    check(kind);
    const v = await be.get(kind);
    if (v !== undefined) return v;
    const old = (await area().get(LEGACY[kind]))[LEGACY[kind]];
    if (old === undefined) return null;
    await be.set(kind, old); await area().remove(LEGACY[kind]); // moved, not copied: the storage gets its room back
    return old;
  }
  return {
    getPhoto,
    /** several at once: { bg, fg, depth } for the kinds asked (null where there is none) */
    async getPhotos(/** @type {string[]} */ kinds) { return Object.fromEntries(await Promise.all(kinds.map(async (k) => [k, await getPhoto(k)]))); },
    async setPhoto(/** @type {string} */ kind, /** @type {any} */ value) { check(kind); await be.set(kind, value); await area().remove(LEGACY[kind]); await bump(); },
    async removePhotos(/** @type {string[]} */ kinds) { kinds.forEach(check); await be.del(kinds); await area().remove(kinds.map((k) => LEGACY[k])); await bump(); },
    /** everything (a reset of all data) */
    async clearPhotos() { await be.clear(); await area().remove(Object.values(LEGACY)); },
  };
}

const shared = makePhotos();
export const { getPhoto, getPhotos, setPhoto, removePhotos, clearPhotos } = shared;
