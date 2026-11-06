-- One row per install that agreed to share. `id` is a random number made on the device when sharing was switched on; it is not derived from anything.
CREATE TABLE IF NOT EXISTS installs (
  id           TEXT PRIMARY KEY,
  first_report INTEGER NOT NULL,   -- ms since 1970, server clock
  last_report  INTEGER NOT NULL,
  app          TEXT NOT NULL,      -- 3.7.0
  br           TEXT NOT NULL,      -- chrome | edge | firefox | other
  os           TEXT NOT NULL,      -- mac | win | linux | cros | other
  lang         TEXT NOT NULL,
  look         TEXT NOT NULL,
  layout       TEXT NOT NULL,
  mode         TEXT NOT NULL,      -- light | dark | auto
  age          INTEGER NOT NULL,   -- days since the install, as of the last report
  act          TEXT NOT NULL,      -- JSON array: the ages (days since the install) on which EyeTime was used; every report adds to it
  pr           TEXT NOT NULL DEFAULT 'ext'   -- ext (the browser extension) | win (the Windows app, which has no browser, look, layout or mode: those hold fixed fillers)
);
CREATE INDEX IF NOT EXISTS installs_first_report ON installs (first_report);
-- The age (in days) at which each feature was first used.
CREATE TABLE IF NOT EXISTS firsts (
  id      TEXT NOT NULL,
  feature TEXT NOT NULL,
  age     INTEGER NOT NULL,
  PRIMARY KEY (id, feature)
);
-- How many times a feature was used, per install and week of the server clock.
CREATE TABLE IF NOT EXISTS usage_weeks (
  id      TEXT NOT NULL,
  week    INTEGER NOT NULL,        -- days since 1970 / 7
  feature TEXT NOT NULL,
  n       INTEGER NOT NULL,
  PRIMARY KEY (id, week, feature)
);
CREATE INDEX IF NOT EXISTS usage_weeks_feature ON usage_weeks (feature, week);
-- What is switched on, as of the last report (a state, replaced by every report that carries it): the names are from the fixed list FLAGS in src/shared/usage-schema.js.
CREATE TABLE IF NOT EXISTS flags (
  id   TEXT NOT NULL,
  flag TEXT NOT NULL,
  PRIMARY KEY (id, flag)
);
-- The arm of each experiment an install is in ("onboarding-v2" → "short"): a state, from the fixed list EXPERIMENTS in src/shared/usage-schema.js.
CREATE TABLE IF NOT EXISTS experiments (
  id  TEXT NOT NULL,
  exp TEXT NOT NULL,
  arm TEXT NOT NULL,
  PRIMARY KEY (id, exp)
);
-- Things the collector counts about its own door, by day and never by who (see INGEST_KINDS in limits.js): how many reports came in, how many were refused and why.
CREATE TABLE IF NOT EXISTS ingest (
  day  TEXT NOT NULL,              -- YYYY-MM-DD, UTC
  kind TEXT NOT NULL,
  n    INTEGER NOT NULL,
  PRIMARY KEY (day, kind)
);
-- Answers to the one question on the page that opens after removal: a count per reason and day, no identifier.
CREATE TABLE IF NOT EXISTS uninstalls (
  day    TEXT NOT NULL,
  reason TEXT NOT NULL,
  n      INTEGER NOT NULL,
  PRIMARY KEY (day, reason)
);
-- Notes the owner puts on the charts ("released 3.8.1"): the owner's own words, not anything from an install.
CREATE TABLE IF NOT EXISTS notes (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  day  TEXT NOT NULL,
  text TEXT NOT NULL
);
-- What the owner copies from the store's own dashboard for a day (active users, installs, removals): the denominator that makes the coverage of this sample known.
CREATE TABLE IF NOT EXISTS store_stats (
  day        TEXT PRIMARY KEY,
  users      INTEGER,
  installs   INTEGER,
  uninstalls INTEGER
);
-- The owner's settings of the dashboard (targets) and the day an alert was last sent.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
