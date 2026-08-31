<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ezra Takes Photos

This repository is the Payload/Figma Cloud version of Ezra's photography site.
Production is `https://ezratakes.photos`; `https://www.ezratakes.photos` redirects
to the apex domain. The active application branch is `payload`. The `main` branch
and the files under `legacy/` preserve the former Eleventy/GitHub Pages site; do
not develop new features there.

## Read before changing code

- Use npm and the committed `package-lock.json`. The required runtime is Node
  24.15 or newer.
- For any Payload-related work, read
  `node_modules/payload/skills/payload/SKILL.md` completely before editing.
- This is Next.js 16, not a conventional older Next.js installation. Before
  changing Next routes, rendering, caching, configuration, or request APIs, read
  the relevant guide under `node_modules/next/dist/docs/` as required by the
  managed block above.
- Production is Figma Cloud, initialized with `@payloadcms/figma`. Do not follow
  the README's older Payload Cloud, MongoDB, S3, or Docker deployment directions.
  Those sections predate the current runtime.

## Architecture and sources of truth

- `src/payload.config.ts` owns the CMS configuration, admin behavior, MCP
  exposure, and Figma integration.
- `src/collections/Photos.ts`, `Sets.ts`, and `Users.ts` own the schemas and
  access rules. A photo is its own upload record; there is no separate media
  collection.
- `src/lib/queries.ts` is intentionally the only data-access surface used by the
  public site. Add public-site Payload queries there rather than scattering
  direct Payload calls through route components.
- `src/app/(frontend)` is the public site. `src/app/(payload)` is the generated
  Payload admin/API surface.
- `src/lib/server-url.ts` owns the canonical production origin. Keep metadata,
  previews, and generated links derived from it.
- `legacy/_posts` and `legacy/photos` are migration inputs and checked-in static
  fallbacks. `legacy/_photos` contains local camera originals and is deliberately
  gitignored.
- `scripts/` contains the migration, redirect, static-photo, and Figma runtime
  packaging workflows.

## Generated files

Do not hand-edit these files unless the generator itself is being repaired:

- `src/payload-types.ts` — run `npm run generate:types` after schema changes.
- `src/app/(payload)/admin/importMap.js` — run `npm run generate:importmap` when
  admin imports change. Other files in `src/app/(payload)` that declare
  themselves automatically generated should be changed through Payload's
  generator, not by hand; `custom.scss` is intentionally hand-maintained.
- `src/generated/static-photo-sources.ts` — produced by
  `npm run generate:static-photos` and also regenerated during a build.
- `redirects.json` — produced by `npm run build:redirects` from migrated
  `legacySlug` values and committed so builds do not need content access merely
  to assemble redirects.

After running a generator, inspect its diff and commit the intended generated
output with the source change.

## Local development and verification

- `npm install` installs dependencies.
- `npm run dev` starts the public site and admin at `http://localhost:3000` and
  `http://localhost:3000/admin`.
- The local `.env` selects a Figma project and environment. Treat any connected
  content environment as shared external state: browsing is safe, but uploads,
  edits, migrations, and deletes require the user's authorization.
- There is currently no separate lint or test script. For code changes, the main
  verification is `FIGMA_EXTRACT_SCHEDULES=true npm run build`. For a
  documentation-only change, `git diff --check` is sufficient.
- A deployable build must contain both `.next/BUILD_ID` and
  `.next/standalone/server.js`.
- The build finishes by packaging Sharp's Linux ARM64 runtime into the standalone
  output. Do not remove `npm run package:figma-runtime` merely because local
  development works on macOS.

## Figma Cloud deployment

Deployments are external writes. Only deploy when the user has asked for it, and
verify the live site afterward. Production is deployed from the local CLI, not
automatically from a branch push. The established flow is:

```bash
FIGMA_EXTRACT_SCHEDULES=true npm run build
npx @payloadcms/figma@alpha login --headless --json
npx @payloadcms/figma@alpha deploy -y --skip-build --adapter nextjs --output .next
```

Use the installed global `deploy-to-figma` skill for deployment work. Keep the
explicit Next.js adapter and `.next` output arguments; do not assume CLI defaults.
After deployment, check the apex homepage, `/admin`, a representative photo, and
the `www` redirect. Do not rerun `figma init` unless the user explicitly wants to
reinitialize the existing project; it can rewrite repository configuration.

The custom domain's Figma-required DNS records are operational state, not repo
configuration. Re-read them in Figma before any DNS change. If DNS is later moved
to Cloudflare, preserve Figma's A, CNAME, and verification TXT values and initially
keep the Figma records DNS-only. Never change registrar, nameserver, or DNS state
as a side effect of ordinary code work.

## Photo import and privacy

- `DRY_RUN=1 npm run migrate` inspects the legacy import without creating
  records. Plain `npm run migrate` writes uploads and records to the selected
  content environment; do not run it without explicit authorization.
- The importer is idempotent by filename and legacy permalink. It prefers
  originals from `legacy/_photos` and falls back to checked-in 960px renditions
  for missing originals. Some originals intentionally fail because they lack a
  usable EXIF capture date; report failures rather than hiding them.
- Never commit `legacy/_photos`, `.env`, `.env.local`, `.uploads`, `.next`, or
  deployment archives.
- EXIF capture time determines ordering and canonical slugs. Preserve the
  UTC-anchored wall-clock behavior in `src/lib/exif.ts`; changing it breaks stable
  links and legacy redirects.
- GPS coordinates are retained for a possible future private map but are
  deliberately not rendered. Do not add GPS to any public UI, metadata, log, or
  agent response without explicit approval.

## Safety and scope

- Preserve unrelated user changes and inspect `git status` before editing.
- Do not merge or rewrite `main` while working on the Payload/Figma application.
- Never print, commit, or paste environment values, login output, tokens, or
  project credentials. It is safe to list environment variable names only.
- The MCP configuration deliberately disables destructive photo/set tools and
  blocks user-collection access. Do not relax those restrictions without an
  explicit security and product decision.
- Treat content mutations, deployments, DNS updates, and git pushes as separate
  actions. Authorization for one does not imply authorization for the others.
