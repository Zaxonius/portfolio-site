import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'https://photo-api-d1.keytehipkins.workers.dev';
const origin = 'https://keytehipkins.com';
const settings = JSON.parse(await readFile('backups/cloudflare/worker-settings.txt', 'utf8')).result;
const password = settings.bindings.find(b => b.name === 'ADMIN_PASSWORD')?.text;
let token = '', testId = '';
async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(base + path, { method, headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  assert.equal(response.status, expected, `Unexpected status for ${method} ${path}: ${data.error || ''}`);
  return data;
}
const health = await request('/health'); assert.equal(health.ready, true);
const initial = await request('/photos'); assert.equal(initial.length, 118);
await request('/photos', 'POST', {}, 401);
token = (await request('/admin-login', 'POST', { password })).token;
assert.match(token, /^[a-f0-9]{64}$/);
try {
  await request('/session');
  const source = initial[0];
  const photo = { url: source.url.replace('/upload/', '/upload/w_1/'), description: 'Temporary migration verification', gallery: 'other' };
  assert.ok(!initial.some(row => row.url === photo.url));
  const saved = await request('/photos', 'POST', photo, 201); testId = saved.id;
  const retry = await request('/photos', 'POST', photo, 201); assert.equal(saved.id, retry.id);
  const edited = await request(`/photos/${testId}`, 'PATCH', { description: 'Temporary edit verification', gallery: 'wildlife' }); assert.equal(edited.gallery, 'wildlife');
  const form = new FormData(); form.set('file', new Blob(['invalid'], { type: 'text/plain' }), 'invalid.txt');
  const invalid = await fetch(base + '/uploads', { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: origin }, body: form }); assert.equal(invalid.status, 400);
  const preflight = await fetch(base + '/photos', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } }); assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  await request(`/photos/${testId}`, 'DELETE'); testId = '';
  assert.equal((await request('/photos')).length, initial.length);
  await request('/logout', 'POST'); await request('/session', 'GET', undefined, 401);
  console.log('Live D1 checks passed: health, 118 photos, login, authenticated publishing/retry/edit/removal, upload validation, CORS and session revocation.');
} finally {
  if (testId) await request(`/photos/${testId}`, 'DELETE');
}
