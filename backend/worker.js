import { customGalleryRoute } from './custom-galleries.js';
const categories = new Set(['wildlife', 'sport', 'motorsport', 'other']);
const encoder = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
export async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export function validatePhoto(body, cloudName) {
  if (!body || (body.gallery !== undefined && !categories.has(body.gallery))) throw new Error('Choose a valid gallery.');
  if (typeof body.description !== 'string' || body.description.length > 500) throw new Error('Captions must be 500 characters or fewer.');
  let url;
  try { url = new URL(body.url); } catch { throw new Error('Invalid image URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${cloudName}/image/upload/`) || url.username || url.password) throw new Error('Use an image from your Cloudinary account.');
  return { url: url.href, description: body.description.trim(), gallery: body.gallery ?? 'other' };
}
async function jsonBody(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new Error('Send JSON data.');
  const text = await request.text();
  if (text.length > 4096) throw new Error('Request is too large.');
  try { return JSON.parse(text); } catch { throw new Error('Invalid JSON.'); }
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
    if (request.method === 'OPTIONS') {
      if (!allowed.includes(origin)) return reply({ error: 'Origin not allowed.' }, 403);
      return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } });
    }
    if (request.method !== 'GET' && origin && !allowed.includes(origin)) return reply({ error: 'Origin not allowed.' }, 403);
    try {
      if (path === '/health' && request.method === 'GET') {
        await env.DB.prepare('SELECT COUNT(*) AS count FROM photos').first();
        return reply({ ready: Boolean(env.ADMIN_PASSWORD), database: 'd1' });
      }
      if (path === '/admin-login' && request.method === 'POST') {
        if (!env.ADMIN_PASSWORD) return reply({ error: 'Admin login is not configured yet.' }, 503);
        const body = await jsonBody(request);
        if (typeof body.password !== 'string' || body.password.length > 256) return reply({ error: 'Enter your password.' }, 400);
        const time = now();
        const ip = await hash(request.headers.get('CF-Connecting-IP') || 'local');
        await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(time).run();
        await env.DB.prepare('DELETE FROM login_attempts WHERE reset_at <= ?').bind(time).run();
        const attempt = await env.DB.prepare(`INSERT INTO login_attempts(ip_hash, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(ip_hash) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`).bind(ip, time + 900).first();
        if (attempt.attempts > 5) return reply({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429);
        const [actual, expected] = await Promise.all([hash(body.password), hash(env.ADMIN_PASSWORD)]);
        let mismatch = 0;
        for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
        if (mismatch) return reply({ error: 'Incorrect password.' }, 401);
        await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash = ?').bind(ip).run();
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
        await env.DB.prepare('INSERT INTO sessions(token_hash, expires_at) VALUES (?, ?)').bind(await hash(token), time + 3600).run();
        return reply({ success: true, token, expiresAt: (time + 3600) * 1000 });
      }
      if ((path === '/photos' || path === '/') && request.method === 'GET') {
        headers['Access-Control-Allow-Origin'] = '*';
        const category = new URL(request.url).searchParams.get('gallery');
        if (category && !categories.has(category)) return reply({ error: 'Unknown gallery.' }, 400);
        const stmt = category ? env.DB.prepare('SELECT * FROM photos WHERE gallery = ? ORDER BY created_at DESC, id DESC').bind(category) : env.DB.prepare('SELECT * FROM photos ORDER BY created_at DESC, id DESC');
        const { results } = await stmt.all();
        return reply(results);
      }
      if (/^\/galleries\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && request.method === 'GET') {
        headers['Access-Control-Allow-Origin'] = '*';
        return await customGalleryRoute({ request, path, env, reply, jsonBody, validatePhoto, authenticated: false });
      }
      const bearer = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      const tokenHash = bearer ? await hash(bearer) : '';
      const session = bearer && await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(tokenHash, now()).first();
      if (!session) return reply({ error: 'Please sign in again.' }, 401);
      const customResponse = await customGalleryRoute({ request, path, env, reply, jsonBody, validatePhoto, authenticated: true });
      if (customResponse) return customResponse;
      if (path === '/session' && request.method === 'GET') return reply({ success: true });
      if (path === '/logout' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
        return reply({ success: true });
      }
      if (path === '/uploads' && request.method === 'POST') {
        if (Number(request.headers.get('Content-Length')) > 300 * 1024) return reply({ error: 'The compressed image is too large. Please try again.' }, 413);
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File) || !file.size || file.size > 256 * 1024 || file.type !== 'image/jpeg') return reply({ error: 'Upload a compressed JPEG using the admin page.' }, 400);
        const upload = new FormData();
        upload.set('file', file);
        upload.set('upload_preset', env.CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: upload });
        const data = await response.json();
        if (!response.ok || !data.secure_url) return reply({ error: 'Image storage could not complete the upload. Please try again.' }, 502);
        return reply({ url: data.secure_url }, 201);
      }
      if ((path === '/photos' || path === '/') && request.method === 'POST') {
        const photo = validatePhoto(await jsonBody(request), env.CLOUDINARY_CLOUD_NAME);
        // Retrying a save after a lost response must not create duplicate photos.
        await env.DB.prepare('INSERT INTO photos(id, url, description, gallery) VALUES (?, ?, ?, ?) ON CONFLICT(url) DO NOTHING').bind(crypto.randomUUID(), photo.url, photo.description, photo.gallery).run();
        return reply(await env.DB.prepare('SELECT * FROM photos WHERE url = ?').bind(photo.url).first(), 201);
      }
      const match = path.match(/^\/photos\/([^/]+)$/);
      if (match && request.method === 'PATCH') {
        const existing = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(match[1]).first();
        if (!existing) return reply({ error: 'Photo no longer exists.' }, 404);
        const body = await jsonBody(request);
        const photo = validatePhoto({ ...body, url: existing.url }, env.CLOUDINARY_CLOUD_NAME);
        await env.DB.prepare('UPDATE photos SET description = ?, gallery = ? WHERE id = ?').bind(photo.description, photo.gallery, match[1]).run();
        return reply({ ...existing, ...photo });
      }
      if (match && request.method === 'DELETE') {
        const result = await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(match[1]).run();
        return result.meta.changes ? reply({ success: true }) : reply({ error: 'Photo no longer exists.' }, 404);
      }
      return reply({ error: 'Not found.' }, 404);
    } catch (error) {
      if (/Choose|Captions|Invalid|Use an image|Send JSON|Request is|Gallery name|gallery name is reserved/.test(error.message)) return reply({ error: error.message }, 400);
      console.error('API request failed:', error.message);
      return reply({ error: 'The photo service is temporarily unavailable. Please try again.' }, 503);
    }
  }
};
