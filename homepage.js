import './contact.js?v=11';
const portrait = new Image();
portrait.onload = () => { const target = document.getElementById('portrait'); target.src = portrait.src; target.alt = 'Keyte Hipkins'; };
portrait.src = '/images/portrait.jpg';
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('.home-section > h2, .home-contact p, .simple-links').forEach(element => {
    element.classList.add('scroll-reveal');
    observer.observe(element);
  });
}
import { photoRows } from './photo-layout.js?v=9';
const gallery = document.getElementById('photo-gallery');
const galleryStatus = document.getElementById('gallery-status');
const viewer = document.getElementById('photoViewer');
const viewerImage = document.getElementById('viewer-image');
const viewerCaption = document.getElementById('viewer-caption');
const previousPhoto = document.getElementById('previousPhoto');
const nextPhoto = document.getElementById('nextPhoto');
const closePhotoButton = document.getElementById('closePhotoViewer');
let viewerCards = [], viewerIndex = 0, viewerBusy = false, viewerClosing = false;
let viewerTransition = Promise.resolve(), imageVersion = 0;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const viewerControls = [viewerCaption, closePhotoButton, previousPhoto, nextPhoto];
function updateViewerPhoto() {
  const card = viewerCards[viewerIndex];
  const version = ++imageVersion;
  viewerImage.src = card.image.currentSrc || card.image.src;
  viewerImage.alt = card.photo.description || 'Photograph by Keyte Hipkins';
  viewerCaption.textContent = card.photo.description || '';
  viewerCaption.hidden = !card.photo.description;
  previousPhoto.disabled = viewerIndex === 0;
  nextPhoto.disabled = viewerIndex === viewerCards.length - 1;
  const fullImage = new Image();
  fullImage.onload = () => {
    if (viewer.open && version === imageVersion && !viewerClosing) viewerImage.src = card.photo.url;
  };
  fullImage.src = card.photo.url;
}
function thumbnailTransform(card) {
  const source = card.image.getBoundingClientRect();
  const target = viewerImage.getBoundingClientRect();
  const ratio = card.image.naturalWidth / card.image.naturalHeight || card.ratio;
  const fittedWidth = Math.min(target.width, target.height * ratio);
  const scale = source.width / fittedWidth;
  const x = source.left + source.width / 2 - (target.left + target.width / 2);
  const y = source.top + source.height / 2 - (target.top + target.height / 2);
  return 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')';
}
function openPhoto(photo, trigger) {
  viewerCards = photoCards.filter(card => card.figure.isConnected);
  viewerIndex = viewerCards.findIndex(card => card.open === trigger);
  if (viewerIndex < 0) return;
  viewerClosing = false;
  updateViewerPhoto(); viewer.showModal();
  document.documentElement.classList.add('photo-viewer-open');
  if (!reducedMotion()) {
    viewerBusy = true;
    const animation = viewerImage.animate([
      { transform: thumbnailTransform(viewerCards[viewerIndex]) }, { transform: 'none' }
    ], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    viewer.animate([{ backgroundColor: 'transparent' }, { backgroundColor: '#000' }], { duration: 300 });
    for (const element of viewerControls) element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 180, fill: 'backwards' });
    viewerTransition = animation.finished.catch(() => {}).finally(() => { viewerBusy = false; });
  }
}
async function navigatePhoto(direction) {
  const index = viewerIndex + direction;
  if (viewerBusy || viewerClosing || index < 0 || index >= viewerCards.length) return;
  viewerBusy = true;
  const outgoing = viewerImage.cloneNode();
  outgoing.removeAttribute('id'); outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true');
  const rect = viewerImage.getBoundingClientRect();
  Object.assign(outgoing.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', objectFit: 'contain', pointerEvents: 'none' });
  viewerIndex = index; updateViewerPhoto();
  if (!reducedMotion()) {
    viewer.append(outgoing);
    const duration = 340, easing = 'cubic-bezier(.22, 1, .36, 1)';
    const oldAnimation = outgoing.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(' + (-direction * 55) + '%)', opacity: 0 }], { duration, easing });
    const newAnimation = viewerImage.animate([{ transform: 'translateX(' + (direction * 55) + '%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration, easing });
    viewerCaption.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing });
    viewerTransition = Promise.allSettled([oldAnimation.finished, newAnimation.finished]);
    await viewerTransition;
  }
  outgoing.remove(); viewerBusy = false;
}
async function closePhoto() {
  if (!viewer.open || viewerClosing) return;
  viewerClosing = true; ++imageVersion;
  await viewerTransition;
  const card = viewerCards[viewerIndex];
  // Reveal the CURRENT photo behind the viewer before scaling back to its tile.
  const rect = card.image.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) card.open.scrollIntoView({ block: 'center', behavior: 'instant' });
  if (!reducedMotion()) {
    card.image.style.visibility = 'hidden';
    viewer.classList.add('is-closing');
    const animation = viewerImage.animate([{ transform: 'none' }, { transform: thumbnailTransform(card) }], { duration: 360, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
    viewer.animate([{ backgroundColor: '#000' }, { backgroundColor: 'transparent' }], { duration: 360, fill: 'forwards' });
    for (const element of viewerControls) element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    await animation.finished.catch(() => {});
    card.image.style.visibility = '';
  }
  viewer.close();
}
previousPhoto.addEventListener('click', () => navigatePhoto(-1));
nextPhoto.addEventListener('click', () => navigatePhoto(1));
closePhotoButton.addEventListener('click', closePhoto);
viewer.addEventListener('cancel', event => { event.preventDefault(); closePhoto(); });
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigatePhoto(event.key === 'ArrowLeft' ? -1 : 1); }
  if (event.key.toLowerCase() === 'x') { event.preventDefault(); closePhoto(); }
});
viewer.addEventListener('click', event => {
  if (event.target === viewer || event.target.classList.contains('viewer-content')) closePhoto();
});
viewer.addEventListener('close', () => {
  for (const element of [viewer, viewerImage, ...viewerControls]) element.getAnimations().forEach(animation => animation.cancel());
  viewer.classList.remove('is-closing');
  document.documentElement.classList.remove('photo-viewer-open');
  viewerImage.removeAttribute('src');
  viewerCards[viewerIndex]?.open.focus({ preventScroll: true });
  viewerClosing = false; viewerBusy = false; scheduleLayout();
});
let photoCards = [];
function layoutPhotos() {
  if (viewer.open) return;
  const width = gallery.clientWidth;
  if (!width || !photoCards.length) return;
  const rows = photoRows(photoCards.map(card => card.ratio), width, width < 600 ? 145 : 210);
  const fragment = document.createDocumentFragment();
  let index = 0;
  for (const row of rows.slice(0, 8)) {
    const element = document.createElement('div'); element.className = 'photo-row';
    for (const ratio of row.ratios) {
      const card = photoCards[index++];
      card.figure.style.width = `${ratio * row.height}px`;
      card.image.style.height = `${row.height}px`;
      element.append(card.figure);
    }
    fragment.append(element);
  }
  gallery.replaceChildren(fragment);
}
async function loadPhotos() {
  galleryStatus.textContent = 'Loading photographs...';
  try {
    const response = await fetch(`${window.PORTFOLIO_CONFIG.apiUrl}/photos`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Photo request failed');
    const photos = await response.json();
    if (!Array.isArray(photos)) throw new Error('Invalid photo response');
    for (let i = photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [photos[i], photos[j]] = [photos[j], photos[i]];
    }
    photoCards = photos.map(photo => {
      const figure = document.createElement('figure'); figure.className = 'photo-tile';
      const image = document.createElement('img'); image.alt = photo.description || 'Photograph by Keyte Hipkins'; image.loading = 'lazy'; image.decoding = 'async';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'photo-open';
      open.setAttribute('aria-label', photo.description ? 'Enlarge photograph: ' + photo.description : 'Enlarge photograph');
      open.setAttribute('aria-haspopup', 'dialog'); open.setAttribute('aria-controls', 'photoViewer');
      open.append(image); figure.append(open);
      open.addEventListener('click', () => openPhoto(photo, open));
      const card = { figure, image, open, photo, ratio: 1.5 };
      image.addEventListener('load', () => { card.ratio = image.naturalWidth / image.naturalHeight; scheduleLayout(); });
      image.src = photo.url.replace('/upload/', '/upload/w_800,q_auto,f_auto/');
      return card;
    });
    layoutPhotos(); galleryStatus.textContent = photos.length ? '' : 'New photographs are coming soon.';
  } catch {
    galleryStatus.textContent = 'Could not load the photographs. ';
    const retry = document.createElement('button'); retry.className = 'text-button'; retry.textContent = 'Retry'; retry.addEventListener('click', loadPhotos); galleryStatus.append(retry);
  }
}
let layoutFrame;
function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layoutPhotos); }
new ResizeObserver(scheduleLayout).observe(gallery);
loadPhotos();
