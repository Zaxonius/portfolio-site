import './contact.js?v=11';
import { workVideos } from './work-videos.js?v=7';
import { workProfile } from './work-profile.js?v=11';
const track = document.getElementById('video-carousel');
const videos = workVideos.filter(video => /^[A-Za-z0-9_-]{11}$/.test(video.id));
for (let i = videos.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [videos[i], videos[j]] = [videos[j], videos[i]];
}
for (const video of videos.slice(0, 8)) {
  const card = document.createElement('figure'); card.className = 'video-card';
  const frame = document.createElement('iframe'); frame.src = `https://www.youtube-nocookie.com/embed/${video.id}`;
  frame.title = video.title; frame.loading = 'lazy'; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allowFullscreen = true;
  const caption = document.createElement('figcaption'); caption.textContent = video.title;
  card.append(frame, caption); track.append(card);
}
const previous = document.getElementById('previous-video');
const next = document.getElementById('next-video');
function updateControls() {
  previous.disabled = track.scrollLeft <= 1;
  next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
}
function move(direction) {
  const card = track.firstElementChild;
  if (!card) return;
  track.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
track.addEventListener('scroll', updateControls, { passive: true });
track.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
});
new ResizeObserver(updateControls).observe(track);
updateControls();
const stats = document.getElementById('channel-stats');
for (const stat of workProfile.stats) {
  const item = document.createElement('div'); const number = document.createElement('dd'); number.textContent = stat.value;
  const label = document.createElement('dt'); label.textContent = stat.label; item.append(label, number); stats.append(item);
}
stats.hidden = !workProfile.stats.length;
for (const social of workProfile.socials) {
  const link = document.createElement('a'); link.href = social.url; link.textContent = social.label; link.className = 'link-button'; link.target = '_blank'; link.rel = 'noopener'; document.getElementById('work-socials').append(link);
}
