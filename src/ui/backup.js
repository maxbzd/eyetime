// Backup file download shared by Settings and the Home reminder; remembers when it last happened.

import { h } from './dom.js';
import { exportAll, setRaw } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
export { needsBackup } from '../shared/backup.js';

export async function downloadBackup() {
  const payload = await exportAll();
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  const a = h('a', { href: url, download: `eyetime-backup-${dayKey()}.json` }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  await setRaw({ lastBackupAt: Date.now() });
}

