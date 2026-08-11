ALTER TABLE private_reports ADD COLUMN origin_report_id TEXT NOT NULL DEFAULT '';
ALTER TABLE private_reports ADD COLUMN origin_public_url TEXT NOT NULL DEFAULT '';
ALTER TABLE private_reports ADD COLUMN conversion_job_id TEXT NOT NULL DEFAULT '';
ALTER TABLE private_reports ADD COLUMN converted_at TEXT;
ALTER TABLE private_reports ADD COLUMN recovery_key TEXT;
