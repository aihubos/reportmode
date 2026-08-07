CREATE TABLE IF NOT EXISTS report_requests (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_requests_created_at
  ON report_requests(created_at DESC);
