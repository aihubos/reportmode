CREATE TABLE IF NOT EXISTS lounge_shorts_jobs (
  job_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  topic TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  detailed_prompt TEXT NOT NULL DEFAULT '',
  scenes_json TEXT NOT NULL DEFAULT '[]',
  reservation_status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (reservation_status IN ('reserved', 'confirmed', 'released')),
  media_key TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT '',
  media_size INTEGER NOT NULL DEFAULT 0,
  published_post_id TEXT NOT NULL DEFAULT '',
  publish_request_id TEXT NOT NULL DEFAULT '',
  rights_notice_version TEXT NOT NULL DEFAULT '',
  rights_confirmed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_sub, request_id),
  FOREIGN KEY (job_id) REFERENCES lounge_tool_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_sub) REFERENCES lounge_users(google_sub) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lounge_shorts_user_created
  ON lounge_shorts_jobs(user_sub, created_at DESC);

CREATE TABLE IF NOT EXISTS lounge_shorts_ledger_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('reservation', 'confirmation', 'release')),
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(job_id, event_type),
  CHECK (
    (event_type = 'reservation' AND delta = -5) OR
    (event_type = 'confirmation' AND delta = 0) OR
    (event_type = 'release' AND delta = 5)
  ),
  FOREIGN KEY (job_id) REFERENCES lounge_shorts_jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (user_sub) REFERENCES lounge_users(google_sub) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lounge_shorts_ledger_user_created
  ON lounge_shorts_ledger_events(user_sub, created_at DESC);

UPDATE lounge_tool_settings
   SET build_cost = 5,
       updated_at = '2026-08-24T13:00:00.000Z'
 WHERE tool_id = 'shorts';

ALTER TABLE board_posts ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE board_posts ADD COLUMN media_url TEXT NOT NULL DEFAULT '';
ALTER TABLE board_posts ADD COLUMN media_type TEXT NOT NULL DEFAULT '';
ALTER TABLE board_posts ADD COLUMN shorts_job_id TEXT;
ALTER TABLE board_posts ADD COLUMN rights_notice_version TEXT NOT NULL DEFAULT '';
ALTER TABLE board_posts ADD COLUMN rights_confirmed_at TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_board_posts_shorts_job
  ON board_posts(shorts_job_id)
  WHERE shorts_job_id IS NOT NULL;
