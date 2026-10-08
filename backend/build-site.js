import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'work.html', 'work.css', 'work.js', 'work-profile.js', 'contact.js', 'gallery.html', 'admin.html', 'style.css', 'script.js', 'homepage.css', 'homepage.js', 'photo-layout.js', 'work-videos.js', 'admin.css', 'admin.js', 'image-preparation.js', 'config.js']) await cp(file, `dist/${file}`);
await cp('images', 'dist/images', { recursive: true });
await cp('admin.css', 'dist/admin-black-v3.css');
await cp('admin.css', 'dist/admin-black-v4.css');
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: ['/', '/work', '/work/', '/work.html', '/admin', '/admin/', '/admin.html', '/gallery', '/gallery/', '/gallery.html', '/index', '/index.html', '/images/*', '/*.js', '/*.css', '/favicon.ico'] }));
// Pages automatically serves admin.html at /admin and redirects /admin/ to it.
// A rewrite to the .html path would conflict with Pages' canonical redirect.
await rm('dist/_redirects', { force: true });
await writeFile('dist/_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n/admin\n  Cache-Control: no-store\n/admin/\n  Cache-Control: no-store\n/admin.html\n  Cache-Control: no-store\n/admin-black-v3.css\n  Cache-Control: no-cache\n/admin.js\n  Cache-Control: no-cache\n/config.js\n  Cache-Control: no-cache\n');
console.log('Built static website in dist/ (backend code and backups excluded).');
