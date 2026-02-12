-- Devices table (anonymous device tokens)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- Markings per chapter (JSON blob)
CREATE TABLE IF NOT EXISTS markings (
  device_id TEXT NOT NULL,
  translation TEXT NOT NULL,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, translation, book, chapter)
);

-- Symbol library per device (JSON blob)
CREATE TABLE IF NOT EXISTS symbols (
  device_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- Word-symbol memory per device (JSON blob)
CREATE TABLE IF NOT EXISTS memory (
  device_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
