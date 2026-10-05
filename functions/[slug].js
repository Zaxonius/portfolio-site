export async function onRequest({ request, params, env }) {
  const slug = params.slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response('Gallery not found.', { status: 404 });
  try {
    const galleryResponse = await fetch(`https://photo-api-d1.keytehipkins.workers.dev/galleries/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(15000) });
    if (galleryResponse.status === 404) return new Response('Gallery not found.', { status: 404 });
    if (!galleryResponse.ok) throw new Error('Gallery unavailable');
    const { gallery } = await galleryResponse.json();
    const name = gallery.name.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const assetUrl = new URL('/gallery', request.url);
    const template = await env.ASSETS.fetch(new Request(assetUrl));
    if (!template.ok) throw new Error('Gallery template unavailable');
    const html = (await template.text()).replace('<title>Gallery</title>', `<title>${name} | Keyte Hipkins Photography</title>`).replace('<h1 id="category-title"></h1>', `<h1 id="category-title">${name}</h1>`).replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
    return new Response(request.method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('Gallery temporarily unavailable. Please try again.', { status: 503 });
  }
}
