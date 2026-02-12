CREATE TABLE IF NOT EXISTS notes (
  device_id TEXT NOT NULL,
  translation TEXT NOT NULL,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, translation, book, chapter)
);
