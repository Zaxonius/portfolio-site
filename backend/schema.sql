CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  gallery TEXT NOT NULL CHECK (gallery IN ('wildlife', 'sport', 'motorsport', 'other')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS photos_gallery_created ON photos(gallery, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_created ON photos(created_at DESC);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
