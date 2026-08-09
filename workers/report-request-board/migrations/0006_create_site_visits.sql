CREATE TABLE IF NOT EXISTS report_site_visits (
  site_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (site_id, visitor_id, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_report_site_visits_site_date
  ON report_site_visits(site_id, visit_date DESC);

