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
let photoCards = [];
function layoutPhotos() {
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
  galleryStatus.textContent = 'Loading photographs�';
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
      const caption = document.createElement('figcaption'); caption.textContent = photo.description || ''; figure.append(image, caption);
      const card = { figure, image, ratio: 1.5 };
      image.addEventListener('load', () => { card.ratio = image.naturalWidth / image.naturalHeight; scheduleLayout(); });
      image.src = photo.url.replace('/upload/', '/upload/w_800,q_auto,f_auto/');
      return card;
    });
    layoutPhotos(); galleryStatus.textContent = photos.length ? '' : 'New photographs are coming soon.';
  } catch {
    galleryStatus.textContent = 'Couldn�t load the photographs. ';
    const retry = document.createElement('button'); retry.className = 'text-button'; retry.textContent = 'Retry'; retry.addEventListener('click', loadPhotos); galleryStatus.append(retry);
  }
}
let layoutFrame;
function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layoutPhotos); }
new ResizeObserver(scheduleLayout).observe(gallery);
loadPhotos();
