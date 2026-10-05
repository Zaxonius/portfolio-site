window.addEventListener('load', () => document.body.classList.add('fade-in'));
document.querySelectorAll('.transition-link').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); document.body.classList.remove('fade-in'); document.body.classList.add('fade-out');
    setTimeout(() => { window.location.href = link.href; }, 500);
  });
});
async function loadGallery() {
  const container = document.getElementById('gallery-container');
  if (!container) return;
  const category = new URLSearchParams(window.location.search).get('category');
  const slug = window.location.pathname.replace(/^\/|\/$/g, '');
  const custom = slug !== 'gallery' && slug !== 'gallery.html';
  const names = { wildlife: 'Wildlife and Animals', sport: 'Sport', motorsport: 'Motorsport', other: 'Other Photos' };
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.style.cssText = 'grid-column:1/-1;text-align:center;padding:30px'; container.replaceChildren(status);
  if (!custom && !Object.hasOwn(names, category)) { status.textContent = 'Choose a gallery from the home page.'; return; }
  if (!custom) document.getElementById('category-title').textContent = names[category];
  status.textContent = 'Loading photographs…';
  try {
    const config = window.PORTFOLIO_CONFIG;
    const url = custom ? `${config.apiUrl}/galleries/${encodeURIComponent(slug)}` : `${config.apiUrl}/photos?gallery=${encodeURIComponent(category)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Gallery request failed');
    const data = await response.json();
    if (custom) { document.getElementById('category-title').textContent = data.gallery.name; document.title = `${data.gallery.name} | Keyte Hipkins Photography`; }
    const photos = custom ? data.photos : data; if (!Array.isArray(photos)) throw new Error('Invalid gallery response');
    if (!photos.length) { status.textContent = 'New photographs are coming soon.'; return; }
    for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
    container.replaceChildren();
    for (const photo of photos) {
      const div = document.createElement('div'); div.className = 'gallery-item';
      const image = document.createElement('img'); image.src = photo.url.replace('/upload/', '/upload/w_500,q_auto,f_auto/'); image.alt = photo.description || (custom ? data.gallery.name : names[category]); image.loading = 'lazy';
      const caption = document.createElement('p'); caption.textContent = photo.description || ''; div.append(image, caption); container.append(div);
    }
  } catch {
    status.textContent = 'We couldn’t load the photographs. Please try again. ';
    const retry = document.createElement('button'); retry.textContent = 'Retry'; retry.addEventListener('click', loadGallery); status.append(retry);
  }
}
loadGallery();
