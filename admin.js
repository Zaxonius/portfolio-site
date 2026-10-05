const config = window.PORTFOLIO_CONFIG;
const $ = id => document.getElementById(id);
const names = { wildlife: 'Wildlife & animals', sport: 'Sport', motorsport: 'Motorsport', other: 'Other photos' };
let token = sessionStorage.getItem('portfolio-session') || '';
let photos = [], selectedFile = null, uploadedUrl = '', previewUrl = '', editingId = '', deletingId = '';
let uploadBusy = false;
function message(id, text, state = '') { $(id).textContent = text; $(id).dataset.state = state; }
function showLogin() {
  token = ''; sessionStorage.removeItem('portfolio-session');
  $('loginBox').hidden = false; $('adminPanel').hidden = true; $('logout').hidden = true;
  $('editDialog').close(); $('deleteDialog').close();
}
async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try { response = await fetch(`${config.apiUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(path === '/uploads' ? 120000 : 20000) }); }
  catch { throw new Error('Could not reach the photo service. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/admin-login') { showLogin(); message('loginStatus', 'Your session has expired. Please sign in again.', 'error'); }
    throw new Error(data.error || 'Could not complete the request. Please try again.');
  }
  return data;
}
function showPanel() { $('loginBox').hidden = true; $('adminPanel').hidden = false; $('logout').hidden = false; }
async function refresh() {
  $('refresh').disabled = true; message('libraryStatus', 'Loading your photographs…');
  try { const data = await api('/photos'); if (!Array.isArray(data)) throw new Error('The photo service returned an unexpected response.'); photos = data; render(); message('libraryStatus', ''); }
  catch (error) { message('libraryStatus', error.message, 'error'); }
  finally { $('refresh').disabled = false; }
}
function render() {
  $('stats').replaceChildren();
  for (const [key, label] of [['all', 'Total photographs'], ...Object.entries(names)]) {
    const item = document.createElement('div'); item.className = 'stat';
    const title = document.createElement('span'); title.textContent = label;
    const count = document.createElement('strong'); count.textContent = key === 'all' ? photos.length : photos.filter(p => p.gallery === key).length;
    item.append(title, count); $('stats').append(item);
  }
  const search = $('search').value.trim().toLowerCase(), filter = $('filter').value;
  const visible = photos.filter(p => (filter === 'all' || p.gallery === filter) && p.description.toLowerCase().includes(search));
  $('photoCount').textContent = `${visible.length} of ${photos.length} photographs`;
  $('photoGrid').replaceChildren();
  if (!visible.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = photos.length ? 'No photographs match. Try another caption or gallery.' : 'Your next great shot belongs here. Add your first photograph.'; $('photoGrid').append(empty); }
  for (const photo of visible) {
    const card = document.createElement('article'); card.className = 'photo-card';
    const image = document.createElement('img'); image.src = photo.url.replace('/upload/', '/upload/w_500,q_auto,f_auto/'); image.alt = photo.description || names[photo.gallery]; image.loading = 'lazy';
    const details = document.createElement('div'); details.className = 'photo-details';
    const tag = document.createElement('span'); tag.className = 'category-tag'; tag.textContent = names[photo.gallery];
    const caption = document.createElement('p'); caption.textContent = photo.description || 'Untitled photograph';
    const actions = document.createElement('div'); actions.className = 'photo-actions';
    const edit = document.createElement('button'); edit.className = 'quiet'; edit.textContent = 'Edit'; edit.addEventListener('click', () => {
      editingId = photo.id; $('editDescription').value = photo.description; $('editGallery').value = photo.gallery; $('editPreview').src = image.src; message('editStatus', ''); $('editDialog').showModal();
    });
    const remove = document.createElement('button'); remove.className = 'quiet'; remove.textContent = 'Remove'; remove.addEventListener('click', () => { deletingId = photo.id; message('deleteStatus', ''); $('deleteDialog').showModal(); });
    actions.append(edit, remove); details.append(tag, caption, actions); card.append(image, details); $('photoGrid').append(card);
  }
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('loginButton').disabled = true; message('loginStatus', 'Signing in…');
  try {
    if (!config.useD1) throw new Error('The new photo studio is awaiting database setup. Your public galleries still use the existing database.');
    const data = await api('/admin-login', { method: 'POST', body: JSON.stringify({ password: $('passwordInput').value }) });
    token = data.token; sessionStorage.setItem('portfolio-session', token); $('passwordInput').value = ''; message('loginStatus', ''); showPanel(); await refresh();
  } catch (error) { message('loginStatus', error.message, 'error'); }
  finally { $('loginButton').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (uploadBusy) return;
  try { await api('/logout', { method: 'POST' }); showLogin(); }
  catch (error) { message('libraryStatus', error.message, 'error'); }
});
$('fileInput').addEventListener('change', () => {
  uploadedUrl = ''; selectedFile = $('fileInput').files[0];
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  $('preview').hidden = true; $('fileLabel').textContent = 'Choose a photograph'; message('status', '');
  if (!selectedFile) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type) || selectedFile.size > 10 * 1024 * 1024 || !selectedFile.size) {
    selectedFile = null; $('fileInput').value = ''; message('status', 'Choose a JPEG, PNG or WebP image under 10 MB.', 'error'); return;
  }
  previewUrl = URL.createObjectURL(selectedFile); $('preview').src = previewUrl; $('preview').hidden = false; $('fileLabel').textContent = selectedFile.name;
});
async function compress(file) {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the image. Try another file.')), 'image/jpeg', .88));
  } finally { image.close(); }
}
$('uploadForm').addEventListener('submit', async event => {
  event.preventDefault(); if (uploadBusy) return;
  if (!selectedFile) { message('status', 'Choose a photograph first.', 'error'); return; }
  uploadBusy = true;
  const controls = [...$('uploadForm').elements, $('logout')]; controls.forEach(el => el.disabled = true);
  const caption = $('description').value.trim(), gallery = $('gallery').value;
  try {
    if (!uploadedUrl) {
      message('status', 'Preparing your photograph…'); const blob = await compress(selectedFile);
      const form = new FormData(); form.append('file', blob, 'photograph.jpg');
      message('status', 'Uploading your photograph…'); const data = await api('/uploads', { method: 'POST', body: form }); uploadedUrl = data.url;
    }
    message('status', 'Publishing to your gallery…');
    await api('/photos', { method: 'POST', body: JSON.stringify({ url: uploadedUrl, description: caption, gallery }) });
    message('status', 'Published! Your photograph is now in the gallery.', 'success');
    uploadedUrl = ''; selectedFile = null; $('uploadForm').reset(); $('preview').hidden = true; $('fileLabel').textContent = 'Choose a photograph';
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
    $('uploadButton').textContent = 'Publish photograph →'; await refresh();
  } catch (error) {
    message('status', uploadedUrl ? `${error.message} Your image is uploaded; click Retry publishing to save it.` : error.message, 'error');
    $('uploadButton').textContent = uploadedUrl ? 'Retry publishing →' : 'Publish photograph →';
  } finally { uploadBusy = false; controls.forEach(el => el.disabled = false); }
});
$('refresh').addEventListener('click', refresh); $('search').addEventListener('input', render); $('filter').addEventListener('change', render);
$('closeEdit').addEventListener('click', () => $('editDialog').close());
$('editForm').addEventListener('submit', async event => {
  event.preventDefault(); $('saveEdit').disabled = true; $('closeEdit').disabled = true;
  try { const photo = await api(`/photos/${encodeURIComponent(editingId)}`, { method: 'PATCH', body: JSON.stringify({ description: $('editDescription').value, gallery: $('editGallery').value }) }); photos = photos.map(p => p.id === photo.id ? photo : p); render(); $('editDialog').close(); }
  catch (error) { message('editStatus', error.message, 'error'); }
  finally { $('saveEdit').disabled = false; $('closeEdit').disabled = false; }
});
$('cancelDelete').addEventListener('click', () => $('deleteDialog').close());
$('confirmDelete').addEventListener('click', async () => {
  $('confirmDelete').disabled = true; $('cancelDelete').disabled = true;
  try { await api(`/photos/${encodeURIComponent(deletingId)}`, { method: 'DELETE' }); photos = photos.filter(p => p.id !== deletingId); render(); $('deleteDialog').close(); }
  catch (error) { message('deleteStatus', error.message, 'error'); }
  finally { $('confirmDelete').disabled = false; $('cancelDelete').disabled = false; }
});
window.addEventListener('beforeunload', event => { if (uploadBusy || uploadedUrl) { event.preventDefault(); event.returnValue = ''; } });
if (token && config.useD1) {
  api('/session').then(() => { showPanel(); return refresh(); }).catch(error => { showLogin(); message('loginStatus', error.message, 'error'); });
} else showLogin();
