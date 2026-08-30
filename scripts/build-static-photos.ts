import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

type StaticPhoto = {
  image: string
  legacySlug: string
  original?: string
}

const root = process.cwd()
const postsDir = path.resolve(root, 'legacy/_posts')
const originalsDir = path.resolve(root, 'legacy/_photos')
const w520Dir = path.resolve(root, 'legacy/photos/w520')
const w960Dir = path.resolve(root, 'legacy/photos/w960')
const outputFile = path.resolve(root, 'src/generated/static-photo-sources.ts')

// These are valid originals that were never represented by an Eleventy post.
// Seven were added after the old site's final build; P8230692 had a rendition
// but post generation failed. Their legacySlug values come from their EXIF
// capture times, exactly as migrate-eleventy.ts derives them.
const extras: StaticPhoto[] = [
  { legacySlug: '07-09-2024-26212621', image: 'DSCF3163.jpg', original: 'DSCF3163.jpg' },
  { legacySlug: '19-09-2024-10401040', image: 'DSCF3385.jpg', original: 'DSCF3385.jpg' },
  { legacySlug: '19-09-2024-1301131', image: 'DSCF3393.jpg', original: 'DSCF3393.jpg' },
  {
    legacySlug: '19-09-2024-48114811',
    image: 'DSCF3443-2.jpg',
    original: 'DSCF3443-2.jpg',
  },
  { legacySlug: '19-09-2024-1003103', image: 'DSCF3484.jpg', original: 'DSCF3484.jpg' },
  { legacySlug: '19-09-2024-43284328', image: 'DSCF3501.jpg', original: 'DSCF3501.jpg' },
  { legacySlug: '19-09-2024-4808488', image: 'DSCF3507.jpg', original: 'DSCF3507.jpg' },
  { legacySlug: '23-08-2021-29142914', image: '23_08_2021_032914.jpg' },
]

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function buildMissingRendition(photo: StaticPhoto, width: 520 | 960) {
  if (!photo.original) return
  const destination = path.join(width === 520 ? w520Dir : w960Dir, photo.image)
  if (await fileExists(destination)) return

  const source = path.join(originalsDir, photo.original)
  if (!(await fileExists(source))) {
    throw new Error(`Missing both ${destination} and its source original ${source}`)
  }

  await sharp(source)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(destination)
}

async function readLegacyPosts(): Promise<StaticPhoto[]> {
  const photos: StaticPhoto[] = []
  for (const file of (await fs.readdir(postsDir)).filter((name) => name.endsWith('.md')).sort()) {
    const source = await fs.readFile(path.join(postsDir, file), 'utf8')
    const legacySlug = source.match(/^date_url:\s*"([^"]+)"/m)?.[1]
    const image = source.match(/^image_path:\s*"([^"]+)"/m)?.[1]
    if (!legacySlug || !image) throw new Error(`Incomplete legacy photo metadata in ${file}`)
    photos.push({ legacySlug, image })
  }
  return photos
}

for (const photo of extras) {
  await Promise.all([buildMissingRendition(photo, 520), buildMissingRendition(photo, 960)])
}

const photos = [...(await readLegacyPosts()), ...extras].sort((a, b) =>
  a.legacySlug.localeCompare(b.legacySlug),
)
const seen = new Set<string>()

for (const photo of photos) {
  if (seen.has(photo.legacySlug)) throw new Error(`Duplicate legacy slug: ${photo.legacySlug}`)
  seen.add(photo.legacySlug)
  for (const directory of [w520Dir, w960Dir]) {
    const file = path.join(directory, photo.image)
    if (!(await fileExists(file))) throw new Error(`Missing static rendition: ${file}`)
  }
}

const imports: string[] = ["import type { StaticImageData } from 'next/image'", '']
const entries: string[] = []

for (const [index, photo] of photos.entries()) {
  const small = `photo${index}Small`
  const large = `photo${index}Large`
  imports.push(`import ${small} from ${JSON.stringify(`../../legacy/photos/w520/${photo.image}`)}`)
  imports.push(`import ${large} from ${JSON.stringify(`../../legacy/photos/w960/${photo.image}`)}`)
  entries.push(`  ${JSON.stringify(photo.legacySlug)}: { small: ${small}, large: ${large} },`)
}

const output = `${imports.join('\n')}

export type StaticPhotoSources = {
  small: StaticImageData
  large: StaticImageData
}

export const STATIC_PHOTO_SOURCES: Record<string, StaticPhotoSources> = {
${entries.join('\n')}
}

export function getStaticPhotoSources(legacySlug?: string | null): StaticPhotoSources | undefined {
  return legacySlug ? STATIC_PHOTO_SOURCES[legacySlug] : undefined
}
`

await fs.mkdir(path.dirname(outputFile), { recursive: true })
await fs.writeFile(outputFile, output)
console.log(`Prepared ${photos.length} static photo fallbacks.`)
