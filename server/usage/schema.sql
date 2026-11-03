-- One row per install that agreed to share. `id` is a random number made on the device when sharing was switched on; it is not derived from anything.
CREATE TABLE IF NOT EXISTS installs (
  id           TEXT PRIMARY KEY,
  first_report INTEGER NOT NULL,   -- ms since 1970, server clock
  last_report  INTEGER NOT NULL,
  app          TEXT NOT NULL,      -- 3.5.0
  br           TEXT NOT NULL,      -- chrome | edge | firefox | other
  os           TEXT NOT NULL,      -- mac | win | linux | cros | other
  lang         TEXT NOT NULL,
  look         TEXT NOT NULL,
  layout       TEXT NOT NULL,
  mode         TEXT NOT NULL,      -- light | dark | auto
  age          INTEGER NOT NULL,   -- days since the install, as of the last report
  act          TEXT NOT NULL       -- JSON array: the ages (days since the install) on which EyeTime was used; every report adds to it
);
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
