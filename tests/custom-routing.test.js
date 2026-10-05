import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/[slug].js';
test('custom links use the same gallery template, keep the URL and prevent indexing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { assert.ok(url.endsWith('/galleries/qantas')); return Response.json({ gallery: { name: 'Qantas' }, photos: [] }); };
  try {
    const response = await onRequest({ request: new Request('https://keytehipkins.com/qantas'), params: { slug: 'qantas' }, env: { ASSETS: { fetch: async request => { assert.equal(new URL(request.url).pathname, '/gallery'); return new Response('<head></head><section class="gallery" id="gallery-container"></section>'); } } } });
    assert.equal(response.status, 200); assert.ok(!response.headers.has('Location')); assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow'); assert.ok((await response.text()).includes('class="gallery"'));
    globalThis.fetch = async () => new Response('', { status: 404 });
    assert.equal((await onRequest({ request: new Request('https://keytehipkins.com/missing'), params: { slug: 'missing' }, env: {} })).status, 404);
  } finally { globalThis.fetch = originalFetch; }
});
