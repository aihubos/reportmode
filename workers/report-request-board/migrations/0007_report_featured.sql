CREATE TABLE IF NOT EXISTS report_featured (
  report_id TEXT PRIMARY KEY,
  selected_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_featured_selected_at
  ON report_featured(selected_at DESC);
