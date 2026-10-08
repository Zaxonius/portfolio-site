# Keyte Hipkins Photography

Static portfolio hosted by Cloudflare Pages, with a Cloudflare Worker + D1 photo API and Cloudinary image storage. The photo studio is available at https://keytehipkins.com/admin/.

## Live architecture

- Website: Cloudflare Pages project `keytehipkins`; `portfolio-site` is a second Pages project connected to the same repository.
- API: `https://photo-api-d1.keytehipkins.workers.dev`.
- D1: `portfolio-photos`, binding `DB`, located in Oceania.
- Images: existing Cloudinary account `do3eq8jz9` and upload preset `portfolio-upload`.
- Admin password: encrypted Worker secret `ADMIN_PASSWORD`. The previous password is preserved.

The initial migration imported 118 photo records: wildlife 46, sport 23, motorsport 36, other 13. Every URL, ID, caption and gallery assignment was verified against the source backup. Supabase and the old `photo-api` Worker remain intact for rollback; the new frontend uses D1 exclusively.

D1 Free allows 500 MB per database, 5 million rows read/day and 100,000 rows written/day. Workers and Cloudinary have separate quotas. D1 has no documented manual inactivity-resume requirement. It uses SQLite rather than Supabase's PostgreSQL platform; this site only needs photo metadata. See https://developers.cloudflare.com/d1/platform/pricing/ and https://developers.cloudflare.com/d1/platform/limits/.

## Build and deploy

The homepage uses the black/white design with Manrope typography and reduced-motion-aware animations, a portrait and name introduction, a contact dialog, a randomized photo gallery limited to eight horizontal rows, and a brief contact section. Replace the portrait placeholder by adding `images/portrait.jpg`, and use `images/khlogo.svg` for the header logo. `images/khfavicon.svg` uses the same mark on a black background for browser tabs. The supplied PNG is used on the homepage and gallery headers and as the favicon. Add verified YouTube Shorts IDs/titles to `work-videos.js` to show up to eight randomized portrait videos in the swipeable carousel on `/work`. Channel figures and social links are maintained in `work-profile.js`.

Run `npm install`, `npm test`, then `npm run build`. The build copies only public website assets into `dist/`; backend code, dependencies, private backups and credentials are excluded.

Both Cloudflare Pages projects use `npm run build` and publish `dist/` from the `main` branch. GitHub changes trigger the connected builds. To deploy manually:

```powershell
npx.cmd wrangler pages deploy dist --project-name keytehipkins --branch main
```

Deploy API changes with `npm run deploy:api`. Wrangler preserves encrypted Worker secrets. Do not put the admin password in source code, GitHub or chat. Manage it with Cloudflare's dashboard or interactive `npx.cmd wrangler secret put ADMIN_PASSWORD --config backend/wrangler.jsonc`.

`ALLOWED_ORIGINS` in `backend/wrangler.jsonc` lists the live website domains and local development origins. Add new website domains there before using admin from them. Public photo reads are available without authentication.

## Local development

Run `npm run db:local` to initialise local D1. Create gitignored `backend/.dev.vars` with a local `ADMIN_PASSWORD`, then run `npm run dev:api`. Serve the static files at `http://localhost:8080`; temporarily change `config.js` to `apiUrl: 'http://localhost:8787'`. Restore the production URL before publishing.

`npm test` checks authentication, session expiry, origin restrictions, retry-safe publishing and CRUD against real SQLite. The live migration checks additionally verified the deployed Worker, including login, publishing, editing, removal, upload validation, CORS and session revocation. Browser layout QA needs a connected browser.

## Admin behaviour

Custom galleries are created by name in the admin. A name such as `Qantas 2026` creates `/qantas-2026`, displaying the original name above the same photo layout as the public galleries. Select a custom gallery under Manage photos to upload photos with captions, edit captions, or remove photos. Category controls are hidden for custom galleries. Open or copy the displayed link to share it.

Custom galleries are omitted from the homepage and public API listings. Only admin sessions can list or create them. Their individual links are accessible without signing in and carry `noindex, nofollow`; they are unlisted rather than password-protected. Pages Functions serve these root links using the existing gallery template. Custom records use separate D1 tables, so uploads never appear in public categories. Apply `backend/custom-galleries.sql` to existing D1 databases before deploying this API version.

The studio supports previews, gallery counts, caption search, gallery filters, caption/category editing, removal and logout. Writes and upload proxy requests require a one-hour server-backed session. Logout revokes the session. Login attempts are limited to five per IP per 15 minutes. Captions render as text rather than HTML.

Source JPEG, PNG and WebP photos have no application file-size cap. Before any upload, the browser resizes the image to a maximum 1000-pixel long edge, preserves aspect ratio, and encodes a JPEG of at most 200 KB, reducing quality and dimensions further if needed. It never enlarges small photos. Canvas re-encoding removes the original metadata. Only the compressed JPEG is sent to Cloudinary; the full-resolution source stays on the user's computer. Browser image-decoding and memory limits still apply. The API's 256 KB limit is for compressed output rather than source files.

If image storage succeeds but publishing fails, retry publishing reuses the uploaded image. Removing a photograph removes its public database record; its compressed Cloudinary copy remains available. Compression applies to new uploads; existing Cloudinary files are unchanged. Visitors can download the small website copies but do not receive the full-resolution source through this upload flow.

The existing unsigned Cloudinary upload preset is retained for compatibility. It was already exposed by the previous frontend. Restrict its formats, sizes, folders and quotas in Cloudinary, or switch to signed uploads later. Worker authentication protects the new upload route but cannot make the previously exposed unsigned preset private.

## Migration tools and backups

`node backend/export-supabase.js` makes a read-only backup, import SQL and category counts under gitignored `backups/`. `node backend/import-d1.js` imports the latest backup into the configured D1 database through Cloudflare's API without overwriting existing records. These tools exist for recovery; do not re-import stale Supabase records into the live library after editing or removing photos in D1.

`node backend/verify-migration.js <API_URL> <BACKUP_JSON>` verifies record count, IDs, URLs, captions and gallery assignments. Initial source and Worker backups are kept locally under `backups/`; Worker settings backups may contain the old plain-text credentials, so keep this folder private.

Cloudflare inspection/configuration helpers use the local Wrangler OAuth session and do not print credentials. `move-admin-secret.js` and `smoke-test-live.js` are one-time migration helpers using the original private settings backup; their saved password can become outdated if you change it later.

## Rollback

Restore the original frontend Git revision and the Cloudflare Pages build configuration saved in `backups/cloudflare/pages-*.json`; the old frontend still points to the original Worker and Supabase. The original Worker was preserved unchanged. Any photos added or edited after cutover exist only in D1 and must be exported and reconciled before rolling back. Do not delete either database during recovery.
