// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The address the page shown after removal posts its one answer to, derived from the extension's collector endpoint.
// Empty when the collector is not set up (then the page shows only a thank-you and sends nothing).
/** @param {string} endpoint the value of USAGE_ENDPOINT, e.g. https://x.workers.dev/v1/usage */
export function collectorUninstallUrl(endpoint) {
  try {
    const u = new URL(String(endpoint || ''));
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    return u.origin + '/v1/uninstall';
  } catch { return ''; }
}
