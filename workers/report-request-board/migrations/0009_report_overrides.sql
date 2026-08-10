CREATE TABLE IF NOT EXISTS report_overrides (
  report_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  cover_image TEXT,
  cover_alt TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_overrides_updated_at
  ON report_overrides(updated_at DESC);
