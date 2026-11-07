-- Messages to the maker: ideas, problems, kind words, and the answers to the small questions EyeTime asks at good moments. Kept apart from the anonymous numbers on purpose (own
-- table, best in its own D1 database, see README.md): this is text that people typed, it can hold something personal, it has no usage ID and no IP address, and it is kept until
-- the owner or the person asks for it to go. The optional reply address is erased once answered, and in any case after 90 days.
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,                  -- ms since 1970, server clock
  kind        TEXT NOT NULL,                     -- idea | problem | kudos | session | week | pmf | pause | leaving
  via         TEXT NOT NULL,                     -- door | after_session | week_review | pmf | pause_page | removal
  rating      INTEGER,                           -- see FB_RATING in src/shared/feedback-schema.js
  tags        TEXT NOT NULL DEFAULT '[]',        -- JSON array of chips from the fixed lists
  text        TEXT NOT NULL DEFAULT '',          -- what the person typed
  contact     TEXT,                              -- optional address for an answer; erased when answered or after 90 days
  ctx         TEXT NOT NULL DEFAULT '{}',        -- JSON: app version, browser family, system family, language, product, coarse days of use
  status      TEXT NOT NULL DEFAULT 'new',       -- new | read | starred | done | wont  (the owner's)
  theme       TEXT,                              -- the owner's label for a group of similar messages
  note        TEXT,                              -- the owner's private note
  replied_at  INTEGER,
  done_at     INTEGER,
  quote_ok    INTEGER NOT NULL DEFAULT 0,        -- the owner may quote it (anonymously) in the changelog or the store text
  tk          TEXT                               -- sha256 of the message's ticket (the ticket itself stays on the device); lets the author's answer find its way back; erased with the answer window
);
-- The owner's answers, handed to the device that asks with the ticket. Plain text the owner wrote; erased 14 days after it was handed over, and after 180 days if it never was.
CREATE TABLE IF NOT EXISTS feedback_replies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fid           INTEGER NOT NULL,                -- feedback.id
  ts            INTEGER NOT NULL,
  text          TEXT NOT NULL,
  delivered_at  INTEGER
);
CREATE INDEX IF NOT EXISTS feedback_replies_fid ON feedback_replies (fid);
CREATE INDEX IF NOT EXISTS feedback_ts ON feedback (ts);
CREATE INDEX IF NOT EXISTS feedback_kind ON feedback (kind, ts);
CREATE INDEX IF NOT EXISTS feedback_tk ON feedback (tk);
