CREATE TABLE IF NOT EXISTS private_reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  display_date TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  tags_json TEXT NOT NULL DEFAULT '[]',
  html_key TEXT NOT NULL,
  cover_key TEXT,
  cover_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_private_reports_created_at
  ON private_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS private_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_private_admin_sessions_expires_at
  ON private_admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS private_auth_attempts (
  fingerprint TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  blocked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_private_auth_attempts_blocked_until
  ON private_auth_attempts(blocked_until);
