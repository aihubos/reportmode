CREATE TABLE IF NOT EXISTS report_view_counts (
  report_id TEXT PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_view_daily_visitors (
  report_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  view_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (report_id, visitor_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_report_view_daily_visitors_date
  ON report_view_daily_visitors(view_date);

CREATE TRIGGER IF NOT EXISTS report_view_count_after_insert
AFTER INSERT ON report_view_daily_visitors
BEGIN
  INSERT INTO report_view_counts (report_id, view_count, updated_at)
  VALUES (NEW.report_id, 1, NEW.created_at)
  ON CONFLICT(report_id) DO UPDATE SET
    view_count = report_view_counts.view_count + 1,
    updated_at = excluded.updated_at;
END;

INSERT INTO report_view_counts (report_id, view_count, updated_at) VALUES
  ('260803-macbook-m5-max-local-llm-model-fit', 3, '2026-08-09T15:00:00.000Z'),
  ('260803-tesla-model-y-l-delivery-decision', 15, '2026-08-09T15:00:00.000Z'),
  ('260803-deepseek-v4-flash-comparison', 4, '2026-08-09T15:00:00.000Z'),
  ('260803-buzz-slack-discord-telegram-guide', 3, '2026-08-09T15:00:00.000Z'),
  ('260802-pokemon-pokopia-deep-dive', 2, '2026-08-09T15:00:00.000Z'),
  ('260802-ai-agent-hermes-openclaw-codex', 1, '2026-08-09T15:00:00.000Z'),
  ('260802-iphone-fold-vs-galaxy-fold7-fold8-ultra', 1, '2026-08-09T15:00:00.000Z'),
  ('260802-galaxy-z-fold8-deep-dive', 21, '2026-08-09T15:00:00.000Z'),
  ('260802-apple-foldable-iphone', 1, '2026-08-09T15:00:00.000Z')
ON CONFLICT(report_id) DO NOTHING;
