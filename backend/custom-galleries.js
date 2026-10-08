const reserved = new Set(['work', 'admin', 'gallery', 'index', 'images', 'api', 'photos', 'galleries', 'health', 'uploads', 'session', 'logout', 'admin-login', 'backend', 'functions', 'dist', 'wildlife', 'sport', 'motorsport', 'other', 'favicon', 'robots', 'sitemap', 'assets', 'config', 'style', 'script']);
export function galleryIdentity(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('Gallery name must be 1–80 characters.');
  name = name.trim();
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || slug.length > 80) throw new Error('Gallery name must include letters or numbers for its link.');
  if (reserved.has(slug)) throw new Error('That gallery name is reserved. Choose another name.');
  return { name, slug };
}
export async function customGalleryRoute({ request, path, env, reply, jsonBody, validatePhoto, authenticated }) {
  const match = path.match(/^\/galleries\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/photos(?:\/([^/]+))?)?$/);
  if (path !== '/galleries' && !match) return null;
  const publicRead = match && path === `/galleries/${match[1]}` && request.method === 'GET';
  if (!publicRead && !authenticated) return reply({ error: 'Please sign in again.' }, 401);
  if (path === '/galleries' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT g.*, (SELECT COUNT(*) FROM custom_photos p WHERE p.gallery_id = g.id) AS photo_count FROM custom_galleries g ORDER BY g.created_at DESC, g.id DESC').all();
    return reply(results);
  }
  if (path === '/galleries' && request.method === 'POST') {
    const { name, slug } = galleryIdentity((await jsonBody(request)).name);
    const id = crypto.randomUUID();
    const result = await env.DB.prepare('INSERT INTO custom_galleries(id, name, slug) VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING').bind(id, name, slug).run();
    if (!result.meta.changes) return reply({ error: 'That gallery link is already in use. Choose another name.' }, 409);
    return reply({ id, name, slug, photo_count: 0 }, 201);
  }
  if (!match) return reply({ error: 'Not found.' }, 404);
  const gallery = await env.DB.prepare('SELECT * FROM custom_galleries WHERE slug = ?').bind(match[1]).first();
  if (!gallery) return reply({ error: 'Gallery not found.' }, 404);
  if (publicRead) {
    const { results } = await env.DB.prepare('SELECT id, url, description, created_at FROM custom_photos WHERE gallery_id = ? ORDER BY created_at DESC, id DESC').bind(gallery.id).all();
    return reply({ gallery, photos: results });
  }
  const id = match[2];
  if (path.endsWith('/photos') && request.method === 'POST') {
    const body = await jsonBody(request);
    const photo = validatePhoto({ ...body, gallery: 'other' }, env.CLOUDINARY_CLOUD_NAME);
    await env.DB.prepare('INSERT INTO custom_photos(id, gallery_id, url, description) VALUES (?, ?, ?, ?) ON CONFLICT(gallery_id, url) DO NOTHING').bind(crypto.randomUUID(), gallery.id, photo.url, photo.description).run();
    return reply(await env.DB.prepare('SELECT id, url, description, created_at FROM custom_photos WHERE gallery_id = ? AND url = ?').bind(gallery.id, photo.url).first(), 201);
  }
  if (id && request.method === 'PATCH') {
    const existing = await env.DB.prepare('SELECT * FROM custom_photos WHERE id = ? AND gallery_id = ?').bind(id, gallery.id).first();
    if (!existing) return reply({ error: 'Photo no longer exists.' }, 404);
    const body = await jsonBody(request);
    const photo = validatePhoto({ url: existing.url, description: body.description, gallery: 'other' }, env.CLOUDINARY_CLOUD_NAME);
    await env.DB.prepare('UPDATE custom_photos SET description = ? WHERE id = ? AND gallery_id = ?').bind(photo.description, id, gallery.id).run();
    return reply({ id, url: existing.url, description: photo.description, created_at: existing.created_at });
  }
  if (id && request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM custom_photos WHERE id = ? AND gallery_id = ?').bind(id, gallery.id).run();
    return result.meta.changes ? reply({ success: true }) : reply({ error: 'Photo no longer exists.' }, 404);
  }
  return reply({ error: 'Not found.' }, 404);
}
