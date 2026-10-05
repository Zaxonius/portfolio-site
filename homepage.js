import { workVideos } from './work-videos.js?v=7';
const dialog = document.getElementById('contactDialog');
let closingContact = false;
document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => {
  if (dialog.open) return;
  dialog.classList.remove('is-closing');
  dialog.showModal();
  document.documentElement.classList.add('contact-open');
}));
async function closeContact() {
  if (!dialog.open || closingContact) return;
  closingContact = true;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dialog.classList.add('is-closing');
    await Promise.allSettled(dialog.getAnimations().map(animation => animation.finished));
  }
  dialog.close();
  dialog.classList.remove('is-closing');
  document.documentElement.classList.remove('contact-open');
  closingContact = false;
}
document.getElementById('closeContact').addEventListener('click', closeContact);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeContact(); });
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeContact();
});
const portrait = new Image();
portrait.onload = () => { const target = document.getElementById('portrait'); target.src = portrait.src; target.alt = 'Keyte Hipkins'; };
portrait.src = '/images/portrait.jpg';
const shuffled = [...workVideos];
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const selected = shuffled.slice(0, 3);
if (selected.length) {
  const container = document.getElementById('work-videos'); container.replaceChildren(); container.classList.toggle('multiple-videos', selected.length > 1);
  for (const video of selected) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(video.id)) continue;
    const iframe = document.createElement('iframe'); iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}`;
    iframe.title = video.title; iframe.loading = 'lazy'; iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'; iframe.allowFullscreen = true; container.append(iframe);
  }
}

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('.home-section > h2, .category-card, .work-heading, .work-videos').forEach(element => {
    element.classList.add('scroll-reveal');
    observer.observe(element);
  });
}
