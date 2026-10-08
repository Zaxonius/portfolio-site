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
