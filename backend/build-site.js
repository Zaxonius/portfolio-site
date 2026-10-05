import { cp, mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'gallery.html', 'admin.html', 'style.css', 'script.js', 'admin.css', 'admin.js', 'config.js']) await cp(file, `dist/${file}`);
await cp('images', 'dist/images', { recursive: true });
await writeFile('dist/_redirects', '/admin /admin.html 200\n/admin/ /admin.html 200\n');
await writeFile('dist/_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n/admin.html\n  Cache-Control: no-store\n/config.js\n  Cache-Control: no-cache\n');
console.log('Built static website in dist/ (backend code and backups excluded).');
