import { workVideos } from './work-videos.js?v=6';
const dialog = document.getElementById('contactDialog');
document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.getElementById('closeContact').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
const portrait = new Image();
portrait.onload = () => { const target = document.getElementById('portrait'); target.src = portrait.src; target.alt = 'Keyte Hipkins'; };
portrait.src = '/images/portrait.jpg';
const shuffled = [...workVideos];
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const selected = shuffled.slice(0, 2);
if (selected.length) {
  const container = document.getElementById('work-videos'); container.replaceChildren(); container.classList.toggle('multiple-videos', selected.length > 1);
  for (const video of selected) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(video.id)) continue;
    const iframe = document.createElement('iframe'); iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}`;
    iframe.title = video.title; iframe.loading = 'lazy'; iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'; iframe.allowFullscreen = true; container.append(iframe);
  }
}
