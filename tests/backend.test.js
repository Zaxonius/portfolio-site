import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { validatePhoto } from '../backend/worker.js';
const origin = 'http://localhost:8080';
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../backend/schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../backend/custom-galleries.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) {
    let args = [];
    const stmt = { bind(...values) { args = values; return stmt; }, async first() { return sqlite.prepare(sql).get(...args) || null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: sqlite.prepare(sql).run(...args) }; } };
    return stmt;
  } };
  const env = { DB, ADMIN_PASSWORD: 'test-password-only', ALLOWED_ORIGINS: origin, CLOUDINARY_CLOUD_NAME: 'do3eq8jz9' };
  const request = (path, method = 'GET', body, token, source = origin) => worker.fetch(new Request(`https://example.test${path}`, { method, headers: { Origin: source, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
  return { request, sqlite, env };
}
const photo = { url: 'https://res.cloudinary.com/do3eq8jz9/image/upload/test.jpg', description: "A bird's portrait <script>", gallery: 'wildlife' };
test('custom galleries are admin-created, link-only and isolated from public categories', async () => {
  const { request, sqlite } = setup();
  assert.equal((await request('/galleries')).status, 401);
  assert.equal((await request('/galleries', 'POST', { name: 'Qantas' })).status, 401);
  const { token } = await (await request('/admin-login', 'POST', { password: 'test-password-only' })).json();
  for (const name of ['Admin', 'images', '   ', 'x'.repeat(81), '!!!']) assert.equal((await request('/galleries', 'POST', { name }, token)).status, 400);
  const created = await request('/galleries', 'POST', { name: 'Qantas 2026' }, token); assert.equal(created.status, 201); assert.equal((await created.json()).slug, 'qantas-2026');
  assert.equal((await request('/galleries', 'POST', { name: 'Qantas-2026' }, token)).status, 409);
  await request('/galleries', 'POST', { name: 'Photos Qantas' }, token);
  assert.equal((await request('/galleries/photos-qantas')).status, 200);
  assert.equal((await request('/galleries/missing')).status, 404);
  const empty = await (await request('/galleries/qantas-2026')).json(); assert.equal(empty.gallery.name, 'Qantas 2026'); assert.equal(empty.photos.length, 0);
  await request('/galleries', 'POST', { name: 'Another' }, token);
  assert.equal((await request('/galleries/qantas-2026/photos', 'POST', photo)).status, 401);
  const saved = await request('/galleries/qantas-2026/photos', 'POST', { url: photo.url, description: photo.description }, token); assert.equal(saved.status, 201); const customPhoto = await saved.json(); assert.ok(!('gallery' in customPhoto));
  const retry = await (await request('/galleries/qantas-2026/photos', 'POST', photo, token)).json(); assert.equal(retry.id, customPhoto.id);
  assert.equal((await (await request('/photos')).json()).length, 0);
  assert.equal((await (await request('/galleries/another')).json()).photos.length, 0);
  assert.equal((await request(`/galleries/another/photos/${customPhoto.id}`, 'PATCH', { description: 'Wrong gallery' }, token)).status, 404);
  assert.equal((await request(`/galleries/qantas-2026/photos/${customPhoto.id}`, 'PATCH', { description: 'New caption' }, token)).status, 200);
  assert.equal((await (await request('/galleries/qantas-2026')).json()).photos[0].description, 'New caption');
  await request('/photos', 'POST', photo, token); assert.equal((await (await request('/photos')).json()).length, 1);
  assert.equal((await request(`/galleries/qantas-2026/photos/${customPhoto.id}`, 'DELETE', undefined, token)).status, 200);
  assert.equal((await (await request('/galleries/qantas-2026')).json()).photos.length, 0);
  assert.equal((await (await request('/photos')).json()).length, 1);
  sqlite.close();
});
test('login, photo CRUD, idempotent publishing and logout use the real SQLite schema', async () => {
  const { request, sqlite } = setup();
  assert.equal((await request('/photos', 'POST', photo)).status, 401);
  assert.equal((await request('/admin-login', 'POST', { password: 'wrong' })).status, 401);
  const login = await request('/admin-login', 'POST', { password: 'test-password-only' }); assert.equal(login.status, 200);
  const { token } = await login.json(); assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal((await request('/session', 'GET', undefined, token)).status, 200);
  const created = await request('/photos', 'POST', photo, token); assert.equal(created.status, 201); const record = await created.json();
  assert.equal((await request('/photos', 'POST', photo, token)).status, 201);
  assert.equal((await (await request('/photos?gallery=wildlife')).json()).length, 1);
  assert.equal((await (await request('/photos?gallery=sport')).json()).length, 0);
  const updated = await request(`/photos/${record.id}`, 'PATCH', { description: 'Changed caption', gallery: 'sport' }, token); assert.equal(updated.status, 200);
  assert.equal((await (await request('/photos?gallery=sport')).json())[0].description, 'Changed caption');
  assert.equal((await request(`/photos/${record.id}`, 'DELETE', undefined, token)).status, 200);
  assert.equal((await request(`/photos/${record.id}`, 'DELETE', undefined, token)).status, 404);
  assert.equal((await request('/logout', 'POST', undefined, token)).status, 200);
  assert.equal((await request('/photos', 'POST', photo, token)).status, 401);
  sqlite.close();
});
test('invalid gallery and untrusted origins are rejected', async () => {
  const { request, sqlite } = setup();
  assert.equal((await request('/photos?gallery=bad')).status, 400);
  assert.equal((await request('/admin-login', 'POST', { password: 'test-password-only' }, undefined, 'https://evil.test')).status, 403);
  const response = await request('/photos', 'OPTIONS'); assert.equal(response.status, 204); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  sqlite.close();
});
test('login brute force is limited and expired sessions cannot write', async () => {
  const { request, sqlite } = setup();
  const { token } = await (await request('/admin-login', 'POST', { password: 'test-password-only' })).json();
  sqlite.exec('UPDATE sessions SET expires_at = 0');
  assert.equal((await request('/photos', 'POST', photo, token)).status, 401);
  for (let i = 0; i < 5; i++) assert.equal((await request('/admin-login', 'POST', { password: 'wrong' })).status, 401);
  assert.equal((await request('/admin-login', 'POST', { password: 'test-password-only' })).status, 429);
  sqlite.close();
});
test('photo validation rejects foreign URLs and oversized captions', () => {
  assert.throws(() => validatePhoto({ ...photo, url: 'javascript:alert(1)' }, 'do3eq8jz9'));
  assert.throws(() => validatePhoto({ ...photo, url: 'https://res.cloudinary.com/another/image/upload/a.jpg' }, 'do3eq8jz9'));
  assert.throws(() => validatePhoto({ ...photo, description: 'x'.repeat(501) }, 'do3eq8jz9'));
  assert.throws(() => validatePhoto({ ...photo, gallery: "wildlife'; DROP TABLE photos" }, 'do3eq8jz9'));
});
