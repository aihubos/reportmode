CREATE TABLE IF NOT EXISTS board_posts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_board_posts_created_at
  ON board_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_posts_category_created
  ON board_posts(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_posts_comments
  ON board_posts(comment_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_posts_views
  ON board_posts(view_count DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS board_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (post_id) REFERENCES board_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_board_comments_post_created
  ON board_comments(post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS board_post_daily_views (
  post_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  view_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, visitor_id, view_date),
  FOREIGN KEY (post_id) REFERENCES board_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_board_post_daily_views_date
  ON board_post_daily_views(view_date);

CREATE TRIGGER IF NOT EXISTS board_comments_after_insert
AFTER INSERT ON board_comments
BEGIN
  UPDATE board_posts
     SET comment_count = comment_count + 1
   WHERE id = NEW.post_id;
END;

CREATE TRIGGER IF NOT EXISTS board_comments_after_delete
AFTER DELETE ON board_comments
BEGIN
  UPDATE board_posts
     SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END
   WHERE id = OLD.post_id;
END;

CREATE TRIGGER IF NOT EXISTS board_post_views_after_insert
AFTER INSERT ON board_post_daily_views
BEGIN
  UPDATE board_posts
     SET view_count = view_count + 1
   WHERE id = NEW.post_id;
END;
