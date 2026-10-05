import { readFile } from 'node:fs/promises';
import { validatePhoto } from './worker.js';
const [apiUrl, backupPath] = process.argv.slice(2);
if (!apiUrl || !backupPath) throw new Error('Usage: node backend/verify-migration.js <API_URL> <BACKUP_JSON>');
const expected = JSON.parse(await readFile(backupPath, 'utf8'));
const response = await fetch(`${apiUrl.replace(/\/$/, '')}/photos`, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`D1 API returned ${response.status}.`);
const actual = await response.json();
if (!Array.isArray(actual) || actual.length !== expected.length) throw new Error(`Count mismatch: expected ${expected.length}, received ${actual.length}.`);
const byUrl = new Map(actual.map(photo => [photo.url, photo]));
for (const source of expected) {
  const normalized = validatePhoto({ ...source, description: source.description || '' }, 'do3eq8jz9');
  const target = byUrl.get(normalized.url);
  if (!target || target.description !== normalized.description || target.gallery !== source.gallery || (source.id && target.id !== source.id)) throw new Error(`Migration mismatch for photo ${source.id}.`);
}
console.log(`Verified all ${expected.length} photos: URLs, IDs, captions and gallery assignments match the backup.`);
