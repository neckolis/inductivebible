CREATE TABLE IF NOT EXISTS preferences (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id"),
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
