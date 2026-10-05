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

The studio supports previews, gallery counts, caption search, gallery filters, caption/category editing, removal and logout. Writes and upload proxy requests require a one-hour server-backed session. Logout revokes the session. Login attempts are limited to five per IP per 15 minutes. Captions render as text rather than HTML.

Image preparation preserves aspect ratio and never enlarges small photographs. If image storage succeeds but publishing fails, retry publishing reuses the uploaded image. Removing a photograph removes its public database record; the Cloudinary original remains available.

The existing unsigned Cloudinary upload preset is retained for compatibility. It was already exposed by the previous frontend. Restrict its formats, sizes, folders and quotas in Cloudinary, or switch to signed uploads later. Worker authentication protects the new upload route but cannot make the previously exposed unsigned preset private.

## Migration tools and backups

`node backend/export-supabase.js` makes a read-only backup, import SQL and category counts under gitignored `backups/`. `node backend/import-d1.js` imports the latest backup into the configured D1 database through Cloudflare's API without overwriting existing records. These tools exist for recovery; do not re-import stale Supabase records into the live library after editing or removing photos in D1.

`node backend/verify-migration.js <API_URL> <BACKUP_JSON>` verifies record count, IDs, URLs, captions and gallery assignments. Initial source and Worker backups are kept locally under `backups/`; Worker settings backups may contain the old plain-text credentials, so keep this folder private.

Cloudflare inspection/configuration helpers use the local Wrangler OAuth session and do not print credentials. `move-admin-secret.js` and `smoke-test-live.js` are one-time migration helpers using the original private settings backup; their saved password can become outdated if you change it later.

## Rollback

Restore the original frontend Git revision and the Cloudflare Pages build configuration saved in `backups/cloudflare/pages-*.json`; the old frontend still points to the original Worker and Supabase. The original Worker was preserved unchanged. Any photos added or edited after cutover exist only in D1 and must be exported and reconciled before rolling back. Do not delete either database during recovery.
