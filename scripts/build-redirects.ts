import config from '@payload-config'
import fs from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'

/**
 * Emits redirects.json, mapping every old Eleventy permalink onto its new
 * canonical slug. next.config.ts reads the file at build time, so builds never
 * need database access — and the mapping is reviewable in a diff.
 *
 *   npm run build:redirects
 *
 * Re-run after any migration. The old URLs looked like /photo/12-02-2020-0441441/
 * (see the note in migrate-eleventy.ts for how that string was constructed).
 * Next normalises the trailing slash itself before matching, so one source
 * entry covers both forms.
 */

const OUTPUT = path.resolve(process.cwd(), 'redirects.json')

async function main() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'photos',
    where: { legacySlug: { exists: true } },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, legacySlug: true },
  })

  const seen = new Map<string, string>()
  const conflicts: string[] = []

  for (const doc of docs) {
    const from = doc.legacySlug
    const to = doc.slug
    if (!from || !to) continue

    const existing = seen.get(from)
    if (existing && existing !== to) {
      // The old scheme encoded no hour, so two photos could in principle share
      // one. Not the case today, but fail loudly rather than silently drop one.
      conflicts.push(`${from} -> ${existing} AND ${to}`)
      continue
    }
    seen.set(from, to)
  }

  const redirects = [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, to]) => ({
      source: `/photo/${from}`,
      destination: `/photo/${to}`,
    }))

  await fs.writeFile(OUTPUT, JSON.stringify(redirects, null, 2) + '\n')

  console.log(`Wrote ${redirects.length} redirects to ${path.relative(process.cwd(), OUTPUT)}`)
  if (conflicts.length > 0) {
    console.log(`\n! ${conflicts.length} legacy slugs claimed by more than one photo:`)
    for (const c of conflicts) console.log(`   ${c}`)
  }
  process.exit(conflicts.length > 0 ? 1 : 0)
}

await main()
