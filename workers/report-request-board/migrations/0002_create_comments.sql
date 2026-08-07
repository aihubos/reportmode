CREATE TABLE IF NOT EXISTS report_comments (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '익명',
  content TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_comments_report_created
  ON report_comments(report_id, created_at DESC);
