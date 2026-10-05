// Read-only export. Never deletes or changes Supabase records.
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { validatePhoto } from './worker.js';
const base = process.env.SUPABASE_URL || 'https://gzideerhgdpottfcisdu.supabase.co';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_R_SzwLxuAvWtThANEDM2fw_2K8g85NZ';
const rows = [];
for (let offset = 0; ; offset += 500) {
  const response = await fetch(`${base}/rest/v1/photos?select=*&order=id.asc&offset=${offset}&limit=500`, { headers: { apikey: key }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Supabase export failed (${response.status}). No database changes were made.`);
  const page = await response.json();
  if (!Array.isArray(page)) throw new Error('Unexpected Supabase response.');
  rows.push(...page);
  if (page.length < 500) break;
}
if (!rows.length) throw new Error('Supabase returned no photos. Check access before migrating an empty library.');
await mkdir('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(`backups/supabase-${stamp}.json`, JSON.stringify(rows, null, 2));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const seen = new Set();
const statements = rows.map(row => {
  const photo = validatePhoto({ ...row, description: row.description || '' }, 'do3eq8jz9');
  if (seen.has(photo.url)) throw new Error('Duplicate image URLs found. The JSON backup is saved; resolve duplicates before import.');
  seen.add(photo.url);
  return `INSERT INTO photos(id, url, description, gallery) VALUES (${[row.id || randomUUID(), photo.url, photo.description, photo.gallery].map(quote).join(', ')}) ON CONFLICT(url) DO NOTHING;`;
});
await writeFile('backups/import.sql', statements.join('\n') + '\n');
const counts = Object.fromEntries(['wildlife', 'sport', 'motorsport', 'other'].map(category => [category, rows.filter(row => row.gallery === category).length]));
await writeFile('backups/migration-counts.json', JSON.stringify({ total: rows.length, galleries: counts }, null, 2));
console.log(`Backed up ${rows.length} photographs. Import SQL: backups/import.sql`);
console.log(JSON.stringify(counts));
