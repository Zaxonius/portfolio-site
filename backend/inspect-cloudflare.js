import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const account = 'f9297e00ea1ebb3c51d98fac51b7d26c';
const credentials = await readFile(path.join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), 'utf8');
const token = credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error('No Cloudflare OAuth session found.');
const root = `https://api.cloudflare.com/client/v4/accounts/${account}`;
await mkdir('backups/cloudflare', { recursive: true });
for (const [name, endpoint] of [['worker-content', '/workers/scripts/photo-api/content/v2'], ['worker-settings', '/workers/scripts/photo-api/settings'], ['worker-subdomain', '/workers/scripts/photo-api/subdomain'], ['workers', '/workers/scripts']]) {
  const response = await fetch(root + endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Cloudflare ${name}: HTTP ${response.status}`);
  const content = await response.text();
  await writeFile(`backups/cloudflare/${name}.txt`, content);
  console.log(`Backed up ${name}.`);
  if (name === 'worker-settings') {
    const data = JSON.parse(content).result;
    console.log(JSON.stringify({ compatibility_date: data.compatibility_date, bindings: data.bindings?.map(b => ({ name: b.name, type: b.type })) }));
  }
  if (name === 'worker-content') {
    console.log('Environment references:', [...new Set(content.match(/env\.[A-Z_]+/g))]);
    console.log('Source with string literals redacted:');
    console.log(content.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '[string]').slice(0, 18000));
  }
}
