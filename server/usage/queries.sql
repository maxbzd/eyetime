-- The questions the report is for. Every query is plain SQLite (D1): paste it into `wrangler d1 execute eyetime-usage --command "…"` or any SQL console.
-- "install day" = the day of the last report minus `age`. "Active" = EyeTime was opened or used that day (an entry in `act`). Numbers describe the people who agreed to share:
-- read them as a direction, not as a census (see docs/MEASUREMENT.md).
-- These are the quick questions for a console. The dashboard (server/usage/stats.js) is the reference: it counts people who left as NOT retained (here `age >= …` keeps only the
-- installs that kept reporting, which flatters retention) and it answers for any period. Where the two differ, believe the dashboard.

-- name: overview
SELECT COUNT(*) AS installs,
       SUM(last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 7 * 86400000) AS reported_last_7d,
       SUM(age >= 30) AS older_than_30d
FROM installs;

-- name: activation  (how many reach a first session, and how fast; only installs old enough for the window)
SELECT 'first focus session on the first day' AS step, COUNT(*) AS installs, SUM(f.age <= 0) AS reached
  FROM installs i LEFT JOIN firsts f ON f.id = i.id AND f.feature = 'focus_start'
UNION ALL
SELECT 'first focus session within a week', COUNT(*), SUM(f.age <= 7)
  FROM installs i LEFT JOIN firsts f ON f.id = i.id AND f.feature = 'focus_start' WHERE i.age >= 7
UNION ALL
SELECT 'finished a session within a week', COUNT(*), SUM(f.age <= 7)
  FROM installs i LEFT JOIN firsts f ON f.id = i.id AND f.feature = 'focus_done' WHERE i.age >= 7
UNION ALL
SELECT 'opened the new tab on the first day', COUNT(*), SUM(f.age <= 0)
  FROM installs i LEFT JOIN firsts f ON f.id = i.id AND f.feature = 'newtab_view';

-- name: retention  (by week of install; D1 = active the next day, D7 = any day 7-13, D30 = any day 30-36; an install counts only when its window has been observed)
WITH x AS (
  SELECT id, age, (last_report / 86400000 - age) / 7 AS cohort_week, act FROM installs
)
SELECT date(cohort_week * 7 * 86400, 'unixepoch') AS cohort_from,
       COUNT(*) AS installs,
       ROUND(100.0 * SUM(age >= 1  AND EXISTS (SELECT 1 FROM json_each(x.act) WHERE value = 1)) / NULLIF(SUM(age >= 1), 0), 1) AS d1_pct,
       ROUND(100.0 * SUM(age >= 13 AND EXISTS (SELECT 1 FROM json_each(x.act) WHERE value BETWEEN 7 AND 13)) / NULLIF(SUM(age >= 13), 0), 1) AS d7_pct,
       ROUND(100.0 * SUM(age >= 36 AND EXISTS (SELECT 1 FROM json_each(x.act) WHERE value BETWEEN 30 AND 36)) / NULLIF(SUM(age >= 36), 0), 1) AS d30_pct
FROM x GROUP BY cohort_week ORDER BY cohort_week;

-- name: feature_adoption  (among installs that reported in the last 4 weeks: how many used each feature at all, and the median uses of those who did)
WITH recent AS (SELECT id FROM installs WHERE last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 28 * 86400000),
     per AS (SELECT w.feature, w.id, SUM(w.n) AS n FROM usage_weeks w JOIN recent r ON r.id = w.id WHERE w.week >= (CAST(strftime('%s','now') AS INTEGER) * 1000) / 604800000 - 4 GROUP BY w.feature, w.id)
SELECT feature, COUNT(*) AS installs, ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM recent), 1) AS pct_of_active, SUM(n) AS uses
FROM per GROUP BY feature ORDER BY installs DESC;

-- name: setup  (what the active installs look like: look, layout, language, system)
SELECT 'look' AS what, look AS value, COUNT(*) AS installs FROM installs WHERE last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 28 * 86400000 GROUP BY look
UNION ALL SELECT 'layout', layout, COUNT(*) FROM installs WHERE last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 28 * 86400000 GROUP BY layout
UNION ALL SELECT 'lang', lang, COUNT(*) FROM installs WHERE last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 28 * 86400000 GROUP BY lang
UNION ALL SELECT 'os', os, COUNT(*) FROM installs WHERE last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 28 * 86400000 GROUP BY os
UNION ALL SELECT 'browser', br, COUNT(*) FROM installs WHERE last_report >= (CAST(strftime('%s','now') AS INTEGER) * 1000) - 28 * 86400000 GROUP BY br
ORDER BY what, installs DESC;
