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
CREATE TABLE IF NOT EXISTS custom_galleries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS custom_photos (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL REFERENCES custom_galleries(id),
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(gallery_id, url)
);
CREATE INDEX IF NOT EXISTS custom_photos_gallery_created ON custom_photos(gallery_id, created_at DESC);
