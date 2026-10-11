import { publishBatch, applyPhotoChanges } from './photo-management.js?v=8';
import { compressImage } from './image-preparation.js?v=5';
const config = window.PORTFOLIO_CONFIG;
const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('portfolio-session') || '';
let photos = [], deletingId = '';
let queue = [], batchScope = null, settingsBusy = false, settingsPhotos = [], settingsScope = '';
const selected = new Set();
let settingsRequest = 0;
let uploadBusy = false;
let activeGallery = '', galleries = [];
let galleryBusy = false;
let editingScope = '', deletingScope = '';
const photoEndpoint = (scope = activeGallery) => scope ? `/galleries/${encodeURIComponent(scope)}/photos` : '/photos';
function setGallery() {
  const custom = galleries.find(g => g.slug === activeGallery);

  $('uploadTitle').textContent = custom ? `Upload to ${custom.name}` : 'Upload photos';
  $('shareGallery').hidden = !custom;
  $('batchDestination').textContent = 'Destination: ' + (custom?.name || 'Public website');
  if (custom) { $('galleryLink').href = `${window.location.origin}/${custom.slug}`; $('galleryLink').textContent = $('galleryLink').href; }
}
function galleryOptions() {
  $('galleryManager').replaceChildren(new Option('Public website', ''));
  for (const gallery of galleries) $('galleryManager').append(new Option(`${gallery.name} (${gallery.photo_count})`, gallery.slug));
  $('galleryManager').value = activeGallery;
  setGallery();
}
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
    const error = new Error(data.error || 'Could not complete the request. Please try again.'); error.status = response.status; throw error;
  }
  return data;
}
function showPanel() { $('loginBox').hidden = true; $('adminPanel').hidden = false; $('logout').hidden = false; }
async function refresh() {
  const scope = activeGallery;
  $('refresh').disabled = true; message('libraryStatus', 'Loading your photographs…');
  try {
    const [listing, result] = await Promise.all([api('/galleries'), api(scope ? `/galleries/${encodeURIComponent(scope)}` : '/photos')]);
    if (scope !== activeGallery) return;
    const data = scope ? result.photos : result;
    if (!Array.isArray(data) || !Array.isArray(listing)) throw new Error('The photo service returned an unexpected response.');
    galleries = listing; photos = data; selected.clear(); galleryOptions(); render(); message('libraryStatus', '');
  }
  catch (error) { message('libraryStatus', error.message, 'error'); }
  finally { $('refresh').disabled = false; }
}
function render() {
  const search = $('search').value.trim().toLowerCase();
  const visible = photos.filter(p => (p.description || '').toLowerCase().includes(search));
  updateSelection(visible);
  $('photoCount').textContent = `${visible.length} of ${photos.length} photographs`;
  $('photoGrid').replaceChildren();
  if (!visible.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = photos.length ? 'No matching photos.' : 'No photos yet.'; $('photoGrid').append(empty); }
  for (const photo of visible) {
    const card = document.createElement('article'); card.className = 'photo-card';
    const selectLabel = document.createElement('label'); selectLabel.className = 'photo-select';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(photo.id);
    checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(photo.id) : selected.delete(photo.id); render(); });
    selectLabel.append(checkbox, document.createTextNode('Select photo')); card.append(selectLabel);
    const image = document.createElement('img'); image.src = photo.url.replace('/upload/', '/upload/w_500,q_auto,f_auto/'); image.alt = photo.description || 'Photograph'; image.loading = 'lazy';
    const details = document.createElement('div'); details.className = 'photo-details';
    const caption = document.createElement('p'); caption.textContent = photo.description || 'Untitled photograph';
    const actions = document.createElement('div'); actions.className = 'photo-actions';
    const edit = document.createElement('button'); edit.className = 'quiet'; edit.textContent = 'Settings'; edit.addEventListener('click', () => openSettings([photo]));
    const remove = document.createElement('button'); remove.className = 'quiet'; remove.textContent = 'Remove'; remove.addEventListener('click', () => { deletingId = photo.id; deletingScope = activeGallery; message('deleteStatus', ''); $('deleteDialog').showModal(); });
    actions.append(edit, remove); details.append(caption, actions); card.append(image, details); $('photoGrid').append(card);
  }
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); $('loginButton').disabled = true; message('loginStatus', 'Signing in…');
  try {
    if (!config.useD1) throw new Error('The new photo studio is awaiting database setup. Your public photos still use the existing database.');
    const data = await api('/admin-login', { method: 'POST', body: JSON.stringify({ password: $('passwordInput').value }) });
    token = data.token; sessionStorage.setItem('portfolio-session', token); $('passwordInput').value = ''; message('loginStatus', ''); showPanel(); await refresh();
  } catch (error) { message('loginStatus', error.message, 'error'); }
  finally { $('loginButton').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (uploadBusy || settingsBusy) return;
  try { await api('/logout', { method: 'POST' }); showLogin(); }
  catch (error) { message('libraryStatus', error.message, 'error'); }
});
function renderQueue() {
  $('uploadQueue').replaceChildren();
  for (const item of queue) {
    const card = document.createElement('article'); card.className = 'queue-card';
    const image = document.createElement('img'); image.src = item.preview; image.alt = item.file.name; image.loading = 'lazy';
    const name = document.createElement('p'); name.className = 'queue-name'; name.textContent = item.file.name;
    const label = document.createElement('label'); label.textContent = 'Caption (optional)';
    const caption = document.createElement('textarea'); caption.rows = 2; caption.maxLength = 500; caption.value = item.caption;
    caption.disabled = uploadBusy || item.state === 'published'; caption.addEventListener('input', () => { item.caption = caption.value; }); label.append(caption);
    const status = document.createElement('p'); status.className = 'queue-status'; status.textContent = item.error || (item.state === 'queued' ? 'Ready' : item.state === 'published' ? 'Published' : item.state);
    status.dataset.state = item.state === 'failed' ? 'error' : '';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'quiet'; remove.textContent = item.state === 'published' ? 'Dismiss' : 'Remove'; remove.disabled = uploadBusy;
    remove.addEventListener('click', () => { URL.revokeObjectURL(item.preview); queue = queue.filter(p => p !== item); if (!queue.length) batchScope = null; renderQueue(); });
    card.append(image, name, label, status, remove); $('uploadQueue').append(card);
  }
  $('uploadButton').disabled = uploadBusy || galleryBusy || !queue.some(item => item.state !== 'published');
  $('uploadButton').textContent = queue.some(item => item.state === 'failed') ? 'Retry unpublished photos' : 'Upload photos';
  $('clearQueue').disabled = uploadBusy || !queue.length;
  $('choosePhotos').disabled = uploadBusy;
}
function addFiles(files) {
  if (uploadBusy) return;
  let rejected = 0;
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size) { rejected++; continue; }
    if (queue.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
    queue.push({ file, caption: '', url: '', preview: URL.createObjectURL(file), state: 'queued', error: '' });
  }
  message('status', rejected ? rejected + ' unsupported or empty files skipped. Choose JPEG, PNG or WebP photos.' : ''); renderQueue();
}
$('choosePhotos').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', () => { addFiles($('fileInput').files); $('fileInput').value = ''; });
for (const eventName of ['dragenter', 'dragover']) $('dropZone').addEventListener(eventName, event => { event.preventDefault(); $('dropZone').classList.add('drag-over'); });
$('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('drag-over'));
$('dropZone').addEventListener('drop', event => { event.preventDefault(); $('dropZone').classList.remove('drag-over'); addFiles(event.dataTransfer.files); });
$('clearQueue').addEventListener('click', () => { queue.forEach(item => URL.revokeObjectURL(item.preview)); queue = []; batchScope = null; renderQueue(); message('status', ''); });
$('uploadForm').addEventListener('submit', async event => {
  event.preventDefault(); if (uploadBusy || galleryBusy || settingsBusy || !queue.some(item => item.state !== 'published')) return;
  batchScope ??= activeGallery;
  uploadBusy = true;
  const controls = [...$('createGalleryForm').elements, $('galleryManager'), $('logout'), $('editSelected')]; controls.forEach(el => el.disabled = true); renderQueue();
  try {
    await publishBatch(queue, {
      compress: compressImage,
      upload: async blob => { const form = new FormData(); form.append('file', blob, 'photograph.jpg'); return (await api('/uploads', { method: 'POST', body: form })).url; },
      publish: item => api(photoEndpoint(batchScope), { method: 'POST', body: JSON.stringify({ url: item.url, description: item.caption.trim() }) }),
      canContinue: () => Boolean(token),
      onChange: () => { renderQueue(); message('status', queue.filter(item => item.state === 'published').length + ' of ' + queue.length + ' published.'); }
    });
    const remaining = queue.filter(item => item.state !== 'published').length;
    message('status', remaining ? remaining + ' photos still need publishing. Completed photos are saved; retry the remaining photos.' : 'All ' + queue.length + ' photos published.', remaining ? 'error' : 'success');
    if (token) await refresh();
  } finally { uploadBusy = false; controls.forEach(el => el.disabled = false); renderQueue(); render(); }
});
$('refresh').addEventListener('click', refresh); $('search').addEventListener('input', render);
function updateSelection(visible) {
  $('selectionCount').textContent = selected.size + ' selected';
  $('editSelected').disabled = !selected.size || uploadBusy || settingsBusy;
  $('clearSelection').disabled = !selected.size;
  $('selectAll').checked = Boolean(visible.length) && visible.every(photo => selected.has(photo.id));
  $('selectAll').indeterminate = visible.some(photo => selected.has(photo.id)) && !$('selectAll').checked;
}
$('selectAll').addEventListener('change', () => {
  const search = $('search').value.trim().toLowerCase();
  photos.filter(photo => (photo.description || '').toLowerCase().includes(search)).forEach(photo => $('selectAll').checked ? selected.add(photo.id) : selected.delete(photo.id)); render();
});
$('clearSelection').addEventListener('click', () => { selected.clear(); render(); });
$('editSelected').addEventListener('click', () => openSettings(photos.filter(photo => selected.has(photo.id))));
async function openSettings(items) {
  if (uploadBusy || settingsBusy || !items.length) return;
  const request = ++settingsRequest;
  settingsPhotos = items; settingsScope = activeGallery;
  const multiple = items.length > 1;
  $('editTitle').textContent = multiple ? 'Settings for ' + items.length + ' photos' : 'Photo settings';
  $('editPreview').hidden = multiple; $('editPreview').src = items[0].url;
  $('captionToggleLabel').hidden = !multiple; $('captionToggle').checked = !multiple;
  $('editDescription').value = multiple ? '' : items[0].description || ''; $('editDescription').disabled = multiple;
  $('membershipControls').replaceChildren(); $('saveEdit').disabled = true;
  message('editStatus', 'Loading gallery memberships...'); $('editDialog').showModal();
  try {
    const memberships = await Promise.all(galleries.map(async gallery => ({ gallery, photos: (await api('/galleries/' + encodeURIComponent(gallery.slug))).photos })));
    if (!$('editDialog').open || request !== settingsRequest) return;
    for (const membership of memberships) {
      const count = items.filter(photo => membership.photos.some(p => p.url === photo.url)).length;
      const label = document.createElement('label'); label.textContent = membership.gallery.name + ' (' + count + ' of ' + items.length + ' included)';
      const control = document.createElement('select'); control.dataset.gallery = membership.gallery.slug;
      control.append(new Option('Keep current membership', 'keep'), new Option('Add to gallery', 'add'), new Option('Remove from gallery', 'remove')); label.append(control); $('membershipControls').append(label);
    }
    if (!galleries.length) $('membershipControls').textContent = 'Create a private gallery above to add photos to it.';
    message('editStatus', ''); $('saveEdit').disabled = false;
  } catch (error) { if (request === settingsRequest && $('editDialog').open) message('editStatus', error.message + ' Close settings and try again.', 'error'); }
}
$('captionToggle').addEventListener('change', () => { $('editDescription').disabled = !$('captionToggle').checked; });
$('closeEdit').addEventListener('click', () => { if (!settingsBusy) $('editDialog').close(); });
$('editDialog').addEventListener('cancel', event => { if (settingsBusy) event.preventDefault(); });
$('editForm').addEventListener('submit', async event => {
  event.preventDefault(); if (settingsBusy || uploadBusy) return;
  const memberships = [...$('membershipControls').querySelectorAll('select')].filter(control => control.value !== 'keep').map(control => ({ slug: control.dataset.gallery, action: control.value }));
  const caption = $('captionToggle').checked ? $('editDescription').value.trim() : undefined;
  if (caption === undefined && !memberships.length) { $('editDialog').close(); return; }
  settingsBusy = true;
  const controls = [...$('editForm').elements, $('galleryManager'), $('uploadButton'), $('createGalleryButton'), $('logout')]; controls.forEach(el => el.disabled = true);
  try {
    const result = await applyPhotoChanges(settingsPhotos, settingsScope, { caption, memberships }, api, (done, failed) => message('editStatus', done + ' saved, ' + failed + ' failed.'));
    if (result.failed.length) { settingsPhotos = result.failed.map(item => item.photo); message('editStatus', result.completed + ' saved. ' + result.failed.length + ' failed: ' + result.failed[0].error + ' Retry to finish the remaining photos.', 'error'); }
    else { $('editDialog').close(); await refresh(); }
  } catch (error) { message('editStatus', error.message, 'error'); }
  finally { settingsBusy = false; controls.forEach(el => el.disabled = false); $('editDescription').disabled = !$('captionToggle').checked; renderQueue(); }
});
$('cancelDelete').addEventListener('click', () => $('deleteDialog').close());
$('confirmDelete').addEventListener('click', async () => {
  $('confirmDelete').disabled = true; $('cancelDelete').disabled = true;
  try { await api(`${photoEndpoint(deletingScope)}/${encodeURIComponent(deletingId)}`, { method: 'DELETE' }); photos = photos.filter(p => p.id !== deletingId); render(); $('deleteDialog').close(); await refresh(); }
  catch (error) { message('deleteStatus', error.message, 'error'); }
  finally { $('confirmDelete').disabled = false; $('cancelDelete').disabled = false; }
});
$('galleryManager').addEventListener('change', () => { if (batchScope !== null && queue.some(item => item.state !== 'published')) { $('galleryManager').value = activeGallery; message('status', 'Finish or clear the upload queue before changing galleries.', 'error'); return; } batchScope = null; selected.clear(); $('editDialog').close(); $('deleteDialog').close(); activeGallery = $('galleryManager').value; $('search').value = ''; photos = []; setGallery(); render(); refresh(); });
$('galleryName').addEventListener('input', () => {
  const slug = $('galleryName').value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  $('galleryLinkPreview').textContent = slug ? `${window.location.origin}/${slug}` : '';
});
$('createGalleryForm').addEventListener('submit', async event => {
  event.preventDefault(); if (uploadBusy || galleryBusy || settingsBusy) return; if (batchScope !== null && queue.some(item => item.state !== 'published')) { message('galleryStatus', 'Finish or clear the upload queue first.', 'error'); return; } galleryBusy = true; $('createGalleryButton').disabled = true; $('uploadButton').disabled = true; $('galleryManager').disabled = true; message('galleryStatus', '');
  try { const gallery = await api('/galleries', { method: 'POST', body: JSON.stringify({ name: $('galleryName').value }) }); activeGallery = gallery.slug; batchScope = null; selected.clear(); $('galleryName').value = ''; $('galleryLinkPreview').textContent = ''; $('search').value = ''; await refresh(); message('galleryStatus', 'Created.'); }
  catch (error) { message('galleryStatus', error.message, 'error'); }
  finally { galleryBusy = false; $('createGalleryButton').disabled = false; $('uploadButton').disabled = false; $('galleryManager').disabled = false; renderQueue(); }
});
$('copyGalleryLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('galleryLink').href); message('galleryStatus', 'Link copied.'); }
  catch { message('galleryStatus', 'Copy the link shown above.'); }
});
window.addEventListener('beforeunload', event => { if (uploadBusy || settingsBusy || queue.some(item => item.state !== 'published')) { event.preventDefault(); event.returnValue = ''; } });
if (token && config.useD1) {
  api('/session').then(() => { showPanel(); return refresh(); }).catch(error => { showLogin(); message('loginStatus', error.message, 'error'); });
} else showLogin();
