import config from '@payload-config'
import fs from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'

import { extractExif } from '../src/lib/exif'

/**
 * One-time import of the Eleventy-era photo library into Payload.
 *
 *   DRY_RUN=1 npm run migrate        inspect without writing
 *   npm run migrate                  create the records
 *
 * Run against local Mongo first, verify the summary, then re-run with Payload
 * Cloud credentials in the environment so files land in the real S3 bucket.
 *
 * ---------------------------------------------------------------------------
 * On reconstructing the old permalink
 *
 * The plan assumed we'd rebuild each photo's `image_path` (12_02_2020_090441.jpg)
 * and use it to look up the matching post. That turns out to be the hard way
 * round, and fragile: utils/FormatDate.js formatted with Luxon's `zone: 'utc'`
 * on a Date that fast-exif had already revived in the *build machine's* local
 * zone, so image_path is the EXIF wall clock shifted by whatever UTC offset
 * Ezra's laptop had that day. Reproducing it means reproducing that offset,
 * historical DST included.
 *
 * But `date_url` — the thing we actually need — was formatted with no zone at
 * all (utils/FrontMatter.js), so it is the plain EXIF wall clock:
 *
 *   'dd-LL-yyyy-mmssms'  =  date + padded min + padded sec + unpadded min + unpadded sec
 *   09:04:41 on 12 Feb 2020  ->  "12-02-2020-0441441"
 *   15:43:40 on 12 Feb 2020  ->  "12-02-2020-43404340"
 *
 * That is timezone-independent, so we derive it straight from EXIF and use the
 * old posts only to *verify* the result. Note it encodes no hour, which is why
 * these are being retired in favour of a real slug and a redirect.
 * ---------------------------------------------------------------------------
 */

const PHOTOS_DIR = path.resolve(
  process.cwd(),
  process.env.PHOTO_IMPORT_DIR || 'legacy/_photos',
)
const POSTS_DIR = path.resolve(process.cwd(), 'legacy/_posts')
// An env var, not a flag: `payload run` consumes argv before the script sees
// it, so `npm run migrate -- --dry-run` silently ran a real import.
const DRY_RUN = process.env.DRY_RUN === '1'

const pad = (n: number) => String(n).padStart(2, '0')

/** Reproduces Luxon's 'dd-LL-yyyy-mmssms' against the EXIF wall clock. */
function legacyDateURL(capturedAt: Date): string {
  const day = pad(capturedAt.getUTCDate())
  const month = pad(capturedAt.getUTCMonth() + 1)
  const year = capturedAt.getUTCFullYear()
  const minute = capturedAt.getUTCMinutes()
  const second = capturedAt.getUTCSeconds()
  return `${day}-${month}-${year}-${pad(minute)}${pad(second)}${minute}${second}`
}

async function readKnownDateURLs(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let files: string[] = []
  try {
    files = await fs.readdir(POSTS_DIR)
  } catch {
    console.warn(`! No ${POSTS_DIR} — skipping permalink verification.`)
    return map
  }

  for (const file of files) {
    if (!file.endsWith('.md')) continue
    const contents = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
    const match = contents.match(/^date_url:\s*"([^"]+)"/m)
    if (match) map.set(match[1], file)
  }
  return map
}

async function main() {
  const payload = await getPayload({ config })

  const knownDateURLs = await readKnownDateURLs()
  console.log(`Found ${knownDateURLs.size} legacy posts with a date_url.`)

  const entries = (await fs.readdir(PHOTOS_DIR))
    .filter((f) => /\.(jpe?g)$/i.test(f))
    .sort()
  console.log(`Found ${entries.length} originals in ${PHOTOS_DIR}.`)
  if (DRY_RUN) console.log('\n-- DRY RUN: nothing will be written --\n')

  const created: string[] = []
  const skipped: string[] = []
  const failed: { file: string; reason: string }[] = []
  const matchedDateURLs = new Set<string>()

  for (const file of entries) {
    const filePath = path.join(PHOTOS_DIR, file)

    try {
      const existing = await payload.find({
        collection: 'photos',
        where: { filename: { equals: file } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        skipped.push(`${file} (already imported)`)
        continue
      }

      // Parse here as well as in the collection hook, so a bad file is reported
      // by name with a reason instead of failing anonymously inside create().
      const buffer = await fs.readFile(filePath)
      const exif = await extractExif(buffer)
      const legacySlug = legacyDateURL(exif.capturedAt)

      if (knownDateURLs.size > 0) {
        if (knownDateURLs.has(legacySlug)) {
          matchedDateURLs.add(legacySlug)
        } else {
          console.warn(`  ? ${file}: derived date_url ${legacySlug} matches no legacy post`)
        }
      }

      if (DRY_RUN) {
        created.push(`${file} -> ${legacySlug}`)
        continue
      }

      const doc = await payload.create({
        collection: 'photos',
        filePath,
        data: {
          legacySlug,
          _status: 'published',
        },
        // The hooks re-derive everything else from the file itself.
        context: { disableRevalidate: true },
        overrideAccess: true,
      })

      created.push(`${file} -> /photo/${doc.slug}`)
      process.stdout.write('.')
    } catch (error) {
      failed.push({ file, reason: error instanceof Error ? error.message : String(error) })
      process.stdout.write('x')
    }
  }

  console.log('\n\n' + '='.repeat(64))
  console.log(`Created: ${created.length}`)
  console.log(`Skipped: ${skipped.length}`)
  console.log(`Failed:  ${failed.length}`)

  if (failed.length > 0) {
    console.log('\nFailures — each of these needs a decision:')
    for (const { file, reason } of failed) console.log(`  x ${file}\n      ${reason}`)
  }

  const orphaned = [...knownDateURLs.entries()].filter(([url]) => !matchedDateURLs.has(url))
  if (orphaned.length > 0) {
    console.log(`\nLegacy posts with no matching original (${orphaned.length}):`)
    for (const [url, file] of orphaned) console.log(`  - ${file} (${url})`)
  }

  console.log('='.repeat(64))
  if (!DRY_RUN) console.log('\nNext: npm run build:redirects')
  process.exit(failed.length > 0 ? 1 : 0)
}

await main()
