import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const accountId = 'f9297e00ea1ebb3c51d98fac51b7d26c';
export async function cloudflare(endpoint, options = {}) {
  const credentials = await readFile(path.join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), 'utf8');
  const token = credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  if (!token) throw new Error('Cloudflare sign-in required.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${endpoint}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare API HTTP ${response.status}: ${data.errors?.map(e => e.message).join('; ') || 'Request failed'}`);
  return data.result;
}
