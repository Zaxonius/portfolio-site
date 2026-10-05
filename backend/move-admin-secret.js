// Preserve the existing password without printing it or committing it.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const config = await readFile(path.join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), 'utf8');
const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error('Cloudflare sign-in required.');
const settings = JSON.parse(await readFile('backups/cloudflare/worker-settings.txt', 'utf8')).result;
const password = settings.bindings.find(b => b.name === 'ADMIN_PASSWORD' && b.type === 'plain_text')?.text;
if (!password || password.length > 256) throw new Error('Existing admin password is missing or unsupported.');
const response = await fetch('https://api.cloudflare.com/client/v4/accounts/f9297e00ea1ebb3c51d98fac51b7d26c/workers/scripts/photo-api-d1/secrets', {
  method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'ADMIN_PASSWORD', text: password, type: 'secret_text' })
});
if (!response.ok || !(await response.json()).success) throw new Error(`Could not preserve admin password (HTTP ${response.status}).`);
console.log('Existing admin password preserved as an encrypted secret on photo-api-d1.');
