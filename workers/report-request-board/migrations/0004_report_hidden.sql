CREATE TABLE IF NOT EXISTS report_hidden (
  report_id TEXT PRIMARY KEY,
  hidden_at TEXT NOT NULL,
  note TEXT DEFAULT ''
);
