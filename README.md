# Ezra Takes Photos

A photo site backed by [Payload CMS 4](https://payloadcms.com), running as a Next.js app.

Upload a photo in the admin; EXIF, three WebP derivatives, a blur placeholder and the
permalink are all derived from the file itself. There is no build step to run and no
files to commit.

> The Eleventy version of this site lives on the `main` branch, and the code it
> replaced is under `legacy/` until the Payload Cloud import is confirmed.

## What runs where

| | Needs |
|---|---|
| **Deploying** | A browser. Payload Cloud builds from this repo — no local checkout required. |
| **Local development** | Node ≥ 24.15, Docker (for MongoDB), and an `.env`. |
| **The one-time photo import** | All of the above **plus the camera originals**, which are *not* in git. |

That last row is the only thing that makes one computer different from another —
see [Moving to another machine](#moving-to-another-machine).

## Local development

```bash
git clone git@github.com:ezramechaber/ezra-takes-photos.git
cd ezra-takes-photos
git checkout payload
npm install

cp .env.example .env
# Fill in PAYLOAD_SECRET and PREVIEW_SECRET:
#   openssl rand -hex 32

docker compose up -d     # MongoDB on :27017
npm run dev              # site on :3000, admin on :3000/admin
```

The first visit to `/admin` prompts you to create a user. The local database starts
empty; it is disposable, and nothing in it is shared with production.

## Moving to another machine

`git clone` gets you everything **except the camera originals**. `legacy/_photos` is
656MB and has been gitignored since the original site was built (`.gitignore:106`),
so those files have never been versioned and never will be.

This matters exactly once — during the import — and there are two ways around it:

1. **Don't move them.** Run `npm run migrate` from whichever machine already has the
   originals, pointed at Payload Cloud (see below). It writes over the network. The
   other machine only ever needs the code.
2. **Copy them across** with `rsync`, an external drive, or AirDrop, into
   `legacy/_photos/` on the new machine.

After the import, no computer needs the originals again: publishing is a browser
action, and Payload keeps the full-resolution file in S3 alongside the derivatives.

Also worth noting: `.env` is not in git. Generate fresh secrets on the new machine —
they only need to match across machines if you're sharing a database.

## Deploying to Payload Cloud

1. Push this branch: `git push -u origin payload`
2. In Payload Cloud, create a project pointing at this repo and the `payload` branch.
   Cloud provisions MongoDB and an S3 bucket and injects `DATABASE_URI` and the
   `PAYLOAD_CLOUD_*` variables; `payloadCloudPlugin()` in `src/payload.config.ts`
   picks them up with no code change.
3. Set these yourself in the Cloud project's environment:
   - `PAYLOAD_SECRET` — a fresh `openssl rand -hex 32`
   - `PREVIEW_SECRET` — likewise; guards the `/preview` route
   - `NEXT_PUBLIC_SERVER_URL` — the deployed origin, used for live preview and `og:` tags
4. Verify on the Cloud-provided URL. `ezratakes.photos` keeps serving from GitHub
   Pages until you repoint DNS, so there is no rush and rollback is a DNS change.

## Importing the old library

Run against local Mongo first, then against Cloud with its credentials exported in
your shell so files land in the real S3 bucket.

```bash
DRY_RUN=1 npm run migrate    # report only, writes nothing
npm run migrate              # create the records
npm run build:redirects      # regenerate redirects.json, then commit it
```

`PHOTO_IMPORT_DIR` can point the importer at another folder. For example,
`PHOTO_IMPORT_DIR=legacy/photos/w960 npm run migrate` imports the checked-in 960px
copies when the camera originals are unavailable. The originals remain preferable
because Payload can retain the full-resolution source and generate larger derivatives.

`payload run` consumes argv before the script sees it, which is why the dry run is an
environment variable and not a `--flag`.

The import is idempotent on filename, so re-running is safe — useful if you recover
more originals later. 104 of 109 photos import; the other 5 have no EXIF capture date
and are listed by name so you can fix or drop them.

## Scripts

| | |
|---|---|
| `npm run dev` | Next dev server (site + admin) |
| `npm run build` / `npm start` | Production build and server |
| `npm run migrate` | Import `legacy/_photos` into Payload |
| `npm run build:redirects` | Regenerate `redirects.json` from `legacySlug` values |
| `npm run generate:types` | Rewrite `src/payload-types.ts` after a schema change |
| `npm run payload` | The Payload CLI |

## Layout

```
src/
  payload.config.ts              collections, live preview, Cloud plugin
  collections/                   Photos (an upload collection), Sets, Users
  lib/exif.ts                    EXIF + blur placeholder, from an upload buffer
  lib/queries.ts                 every read the public site makes
  app/(payload)/                 admin panel and REST/GraphQL
  app/(frontend)/                the public site
scripts/                         one-time import, redirect generation
redirects.json                   104 permanent redirects from the old permalinks
```

`lib/queries.ts` is deliberately the single data surface: the photo library is the
durable thing here, and the front end is meant to be cheap to replace.

## Credits

The Eleventy version this replaced was based on a
[project by Chris Collins](https://github.com/scottishstoater/jamstack-photo-website).

## A note on privacy

EXIF can carry a lot of identifying information. This site stores camera, lens, ISO,
aperture, shutter and focal length, and renders them under each photo. GPS
coordinates are extracted and stored but **not** displayed anywhere — if you would
rather not keep them at all, drop the `gps` field from `src/collections/Photos.ts`.
