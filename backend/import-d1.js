import { readFile, readdir } from 'node:fs/promises';
import { cloudflare } from './cloudflare-client.js';
import { validatePhoto } from './worker.js';
const config = JSON.parse(await readFile('backend/wrangler.jsonc', 'utf8'));
const endpoint = `/d1/database/${config.d1_databases[0].database_id}/query`;
const query = async body => {
  const results = await cloudflare(endpoint, { method: 'POST', body: JSON.stringify(body) });
  if (results.some(result => !result.success)) throw new Error('D1 query failed.');
  return results;
};
await query({ sql: await readFile('backend/schema.sql', 'utf8') });
const filename = (await readdir('backups')).filter(name => /^supabase-.*\.json$/.test(name)).sort().at(-1);
if (!filename) throw new Error('Export Supabase before importing.');
const rows = JSON.parse(await readFile(`backups/${filename}`, 'utf8'));
for (let offset = 0; offset < rows.length; offset += 20) {
  const batch = rows.slice(offset, offset + 20).map(row => {
    const photo = validatePhoto({ ...row, description: row.description || '' }, 'do3eq8jz9');
    return { sql: 'INSERT INTO photos(id, url, description, gallery) VALUES (?, ?, ?, ?) ON CONFLICT(url) DO NOTHING', params: [row.id, photo.url, photo.description, photo.gallery] };
  });
  await query({ batch });
}
const result = await query({ sql: 'SELECT gallery, COUNT(*) AS count FROM photos GROUP BY gallery' });
console.log(`Imported ${rows.length} source records into remote D1.`);
console.log(JSON.stringify(result[0].results));
