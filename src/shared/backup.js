// When Home should gently suggest saving a backup file. Pure.

const DAY = 86_400_000;

/** Pure: should Home gently suggest a backup? Only for people with history worth keeping, at most every 30 days, snoozable. */
export function needsBackup({ now, installedAt, lastBackupAt = 0, daysStored = 0, snoozedUntil = 0 }) {
  if (daysStored < 14 || now < snoozedUntil) return false;
  const since = lastBackupAt || installedAt || now;
  return now - since > 30 * DAY;
}
