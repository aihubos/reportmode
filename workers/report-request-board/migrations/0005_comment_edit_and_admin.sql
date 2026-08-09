ALTER TABLE report_comments ADD COLUMN updated_at TEXT;
ALTER TABLE report_comments ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

