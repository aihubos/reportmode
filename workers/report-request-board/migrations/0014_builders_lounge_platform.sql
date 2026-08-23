CREATE TABLE IF NOT EXISTS lounge_users (
  google_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  build_balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lounge_users_email
  ON lounge_users(email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_lounge_users_updated
  ON lounge_users(updated_at DESC);

CREATE TABLE IF NOT EXISTS lounge_admins (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO lounge_admins (email, active, added_by, created_at)
VALUES ('jeremylee0213@gmail.com', 1, 'system', '2026-08-24T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS lounge_build_ledger (
  id TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_sub, ref_type, ref_id),
  FOREIGN KEY (user_sub) REFERENCES lounge_users(google_sub) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lounge_ledger_user_created
  ON lounge_build_ledger(user_sub, created_at DESC);

CREATE TABLE IF NOT EXISTS lounge_tool_settings (
  tool_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  build_cost INTEGER NOT NULL DEFAULT 1 CHECK (build_cost >= 0 AND build_cost <= 10000),
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'gemini', 'gemini-image', 'anthropic', 'webhook')),
  endpoint_url TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  api_key_ciphertext TEXT NOT NULL DEFAULT '',
  api_key_iv TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO lounge_tool_settings
  (tool_id, display_name, enabled, build_cost, provider, endpoint_url, model, system_prompt, updated_by, updated_at)
VALUES
  ('meeting', 'AI 회의록', 0, 1, 'openai', 'https://api.openai.com/v1/chat/completions', 'gpt-5.6',
   '회의 기록을 한국어로 정리한다. 회의 목적, 핵심 논의, 결정사항, 담당자와 기한이 있는 할 일, 추가 확인 질문 순서로 작성하고 원문에 없는 사실은 만들지 않는다.',
   'system', '2026-08-24T00:00:00.000Z'),
  ('shorts', 'AI 쇼츠 스튜디오', 0, 3, 'openai', 'https://api.openai.com/v1/chat/completions', 'gpt-5.6',
   '긴 영상의 대본이나 주제를 세로형 쇼츠 제작안으로 바꾼다. 첫 3초 훅, 30초 내외 컷 구성, 내레이션, 자막, 화면 지시, 마무리 행동 요청을 한국어로 작성한다.',
   'system', '2026-08-24T00:00:00.000Z'),
  ('webtoon', '웹툰 제작기', 0, 1, 'openai', 'https://api.openai.com/v1/chat/completions', 'gpt-5.6',
   '한국어 공감 웹툰 스토리 작가다. 사용자가 요구한 JSON 형식을 정확히 지키고, 순수 JSON만 출력한다.',
   'system', '2026-08-24T00:00:00.000Z'),
  ('masterpiece', '세계명화 이미지 생성', 0, 2, 'gemini-image', 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', 'gemini-3-pro-image-preview',
   '선택한 명화의 구도와 핵심 특징을 존중하면서 사용자가 작성한 프롬프트에 맞는 이미지를 생성한다.',
   'system', '2026-08-24T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS lounge_tool_jobs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  build_cost INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserving', 'processing', 'completed', 'failed', 'refunded')),
  provider_ref TEXT NOT NULL DEFAULT '',
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_sub, request_id),
  FOREIGN KEY (user_sub) REFERENCES lounge_users(google_sub) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES lounge_tool_settings(tool_id)
);

CREATE INDEX IF NOT EXISTS idx_lounge_tool_jobs_user_created
  ON lounge_tool_jobs(user_sub, created_at DESC);

CREATE TABLE IF NOT EXISTS lounge_admin_audit (
  id TEXT PRIMARY KEY,
  admin_sub TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lounge_admin_audit_created
  ON lounge_admin_audit(created_at DESC);

ALTER TABLE board_posts ADD COLUMN user_sub TEXT;
ALTER TABLE board_posts ADD COLUMN reward_builds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE board_comments ADD COLUMN user_sub TEXT;

CREATE INDEX IF NOT EXISTS idx_board_posts_user_sub
  ON board_posts(user_sub, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_comments_user_sub
  ON board_comments(user_sub, created_at DESC);
