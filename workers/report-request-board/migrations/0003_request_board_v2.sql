ALTER TABLE report_requests ADD COLUMN author TEXT NOT NULL DEFAULT '익명';
ALTER TABLE report_requests ADD COLUMN password_salt TEXT NOT NULL DEFAULT '';
ALTER TABLE report_requests ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE report_requests ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS report_request_replies (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES report_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_request_replies_created_at
  ON report_request_replies(created_at DESC);
