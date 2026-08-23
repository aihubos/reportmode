PRAGMA foreign_keys = OFF;

CREATE TABLE lounge_tool_settings_next (
  tool_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  build_cost INTEGER NOT NULL DEFAULT 1 CHECK (build_cost >= 0 AND build_cost <= 10000),
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'openrouter', 'moonshot', 'gemini', 'gemini-image', 'anthropic', 'webhook')),
  endpoint_url TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  api_key_ciphertext TEXT NOT NULL DEFAULT '',
  api_key_iv TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL
);

INSERT INTO lounge_tool_settings_next
  (tool_id, display_name, enabled, build_cost, provider, endpoint_url, model, system_prompt, api_key_ciphertext, api_key_iv, updated_by, updated_at)
SELECT tool_id, display_name, enabled, build_cost, provider, endpoint_url, model, system_prompt, api_key_ciphertext, api_key_iv, updated_by, updated_at
  FROM lounge_tool_settings;

DROP TABLE lounge_tool_settings;
ALTER TABLE lounge_tool_settings_next RENAME TO lounge_tool_settings;

UPDATE lounge_tool_settings
   SET build_cost = CASE tool_id
         WHEN 'masterpiece' THEN 5
         WHEN 'shorts' THEN 10
         ELSE build_cost
       END,
       updated_at = '2026-08-24T12:00:00.000Z'
 WHERE updated_by = 'system';

ALTER TABLE board_comments ADD COLUMN reward_builds INTEGER NOT NULL DEFAULT 0;

PRAGMA foreign_keys = ON;
