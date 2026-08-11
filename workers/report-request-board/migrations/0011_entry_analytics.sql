CREATE TABLE IF NOT EXISTS report_entry_sessions (
  entry_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  landing_path TEXT NOT NULL DEFAULT '/',
  report_id TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'direct',
  referrer_host TEXT NOT NULL DEFAULT '',
  referrer_path TEXT NOT NULL DEFAULT '',
  referrer_url TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_entry_sessions_site_date
  ON report_entry_sessions(site_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_report_entry_sessions_source_date
  ON report_entry_sessions(source_type, entry_date DESC);

CREATE TABLE IF NOT EXISTS report_admin_jobs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  requested_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  result_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_report_admin_jobs_requested_at
  ON report_admin_jobs(requested_at DESC);

CREATE TABLE IF NOT EXISTS report_admin_job_items (
  job_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  private_report_id TEXT,
  error_message TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_admin_job_items_report
  ON report_admin_job_items(report_id, updated_at DESC);
