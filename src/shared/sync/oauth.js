// Signing in to Google and Microsoft from the browser, without a server of ours: the browser's own sign-in window (chrome.identity.launchWebAuthFlow), and tokens kept on this device.
//   Microsoft: authorization code with PKCE (a public client: no secret), a refresh token renews the access.
//   Google:    the implicit flow (an access token for an hour, renewed by asking again without a window while the person is signed in to Google in the browser): Google's web clients
//              want a client secret for the code flow, which an extension cannot keep.
// The redirect address is the one the browser gives the extension (https://<extension id>.chromiumapp.org/): register exactly that (docs/CONNECTIONS.md).

import { SyncError } from './run.js';
import { http } from './http.js';

const b64url = (/** @type {Uint8Array} */ bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomString = (n = 48) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export async function challengeOf(/** @type {string} */ verifier) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))); }

/** The browser's sign-in window. `env.launch` can replace it (tests). Returns the address the window ended on. */
async function launch(/** @type {string} */ url, /** @type {boolean} */ interactive, /** @type {any} */ env) {
  const fn = env.launch || ((/** @type {string} */ u, /** @type {boolean} */ i) => chrome.identity.launchWebAuthFlow({ url: u, interactive: i }));
  try { const out = await fn(url, interactive); if (!out) throw new Error('closed'); return new URL(out); }
  catch (e) { throw new SyncError(interactive ? 'sign-in was not completed' : 'sign-in needs a window', 'auth'); }
}
export const redirectUri = (/** @type {any} */ env = {}) => (env.redirectUri || chrome.identity.getRedirectURL());

/* ---------- Google (implicit) ---------- */
const G_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
/** @returns {Promise<{ accessToken: string, expiresAt: number }>} */
export async function googleToken(/** @type {string} */ clientId, /** @type {string[]} */ scopes, /** @type {{ interactive: boolean, email?: string }} */ o, /** @type {any} */ env = {}) {
  const state = randomString(16);
  const q = new URLSearchParams({ client_id: clientId, response_type: 'token', redirect_uri: redirectUri(env), scope: scopes.join(' '), state, include_granted_scopes: 'true', prompt: o.interactive ? 'consent select_account' : 'none', ...(o.email ? { login_hint: o.email } : {}) });
  const back = await launch(`${G_AUTH}?${q}`, o.interactive, env);
  const f = new URLSearchParams(back.hash.replace(/^#/, ''));
  if (f.get('error')) throw new SyncError('Google refused: ' + f.get('error'), 'auth');
  if (f.get('state') !== state || !f.get('access_token')) throw new SyncError('Google answered with something unexpected', 'auth');
  return { accessToken: /** @type {string} */ (f.get('access_token')), expiresAt: (env.now ? env.now() : Date.now()) + Number(f.get('expires_in') || 3600) * 1000 };
}

/* ---------- Microsoft (code + PKCE) ---------- */
const M_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const tokenBody = (/** @type {Record<string, string>} */ o) => new URLSearchParams(o).toString();
async function msToken(/** @type {Record<string, string>} */ form, /** @type {any} */ env) {
  const res = await http(`${M_BASE}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: tokenBody(form), fetchImpl: env.fetchImpl, accept: [400, 401] });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new SyncError('Microsoft refused: ' + (j.error || res.status), 'auth');
  return { accessToken: /** @type {string} */ (j.access_token), refreshToken: /** @type {string} */ (j.refresh_token || ''), expiresAt: (env.now ? env.now() : Date.now()) + Number(j.expires_in || 3600) * 1000 };
}
export async function microsoftSignIn(/** @type {string} */ clientId, /** @type {string[]} */ scopes, /** @type {any} */ env = {}) {
  const verifier = randomString(48), state = randomString(16);
  const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri(env), response_mode: 'query', scope: [...scopes, 'offline_access'].join(' '), state, code_challenge: await challengeOf(verifier), code_challenge_method: 'S256', prompt: 'select_account' });
  const back = await launch(`${M_BASE}/authorize?${q}`, true, env);
  if (back.searchParams.get('error')) throw new SyncError('Microsoft refused: ' + back.searchParams.get('error'), 'auth');
  if (back.searchParams.get('state') !== state || !back.searchParams.get('code')) throw new SyncError('Microsoft answered with something unexpected', 'auth');
  return msToken({ client_id: clientId, grant_type: 'authorization_code', code: /** @type {string} */ (back.searchParams.get('code')), redirect_uri: redirectUri(env), code_verifier: verifier, scope: scopes.join(' ') }, env);
}
export const microsoftRefresh = (/** @type {string} */ clientId, /** @type {string} */ refreshToken, /** @type {string[]} */ scopes, /** @type {any} */ env = {}) =>
  msToken({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken, scope: scopes.join(' ') }, env);
