import type { Access, CollectionConfig } from 'payload'
import { revalidatePath } from 'next/cache'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildBlurDataURL, extractExif, slugFromCapturedAt } from '../lib/exif'
import { buildPreviewURL } from '../lib/preview'

/**
 * `photos` is itself the upload collection — there is no separate `media`
 * collection with a relationship pointing at it. On a site that is entirely
 * photographs, splitting "the file" from "the record about the file" would buy
 * nothing and cost a join plus a second upload step on every publish.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url))

const publishedUnlessAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

/** Two photos a second apart share a slug only if the camera lied, but be safe. */
async function ensureUniqueSlug(
  payload: any,
  base: string,
  currentId?: string | number,
): Promise<string> {
  let candidate = base
  let suffix = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await payload.find({
      collection: 'photos',
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })

    const clash = existing.docs.find((doc: { id: string | number }) => doc.id !== currentId)
    if (!clash) return candidate

    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

/**
 * Revalidation must never take down a write. It also runs outside a Next
 * request during `payload run` migrations, where revalidatePath throws.
 */
function safeRevalidate(slug?: string | null) {
  // Adding or removing a photo reshuffles every page of the feed and changes the
  // prev/next links on its neighbours, so invalidate the route patterns wholesale.
  // Regeneration is lazy — this only drops cache entries, it doesn't rebuild.
  const targets: [string, 'page' | 'layout'][] = [
    ['/', 'page'],
    ['/page/[n]', 'page'],
    ['/photo/[slug]', 'page'],
    ['/sets', 'page'],
    ['/sets/[slug]', 'page'],
  ]
  if (slug) targets.push([`/photo/${slug}`, 'page'])

  for (const [path, type] of targets) {
    try {
      revalidatePath(path, type)
    } catch {
      // Not in a Next request context (migration script, CLI). Nothing to purge.
    }
  }
}

export const Photos: CollectionConfig = {
  slug: 'photos',
  admin: {
    useAsTitle: 'slug',
    defaultColumns: ['filename', 'capturedAt', 'cameraModel', '_status'],
    description: 'Upload a photo — EXIF, sizes and permalink are filled in automatically.',
    preview: (doc) => buildPreviewURL('photos', doc?.slug),
  },
  access: {
    read: publishedUnlessAuthenticated,
  },
  versions: {
    drafts: true,
  },
  upload: {
    // Local development only. On Payload Cloud the payloadCloudPlugin swaps in
    // the S3 adapter and nothing is written to the container's disk.
    staticDir: path.resolve(dirname, '../../.uploads'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    adminThumbnail: 'thumb',
    focalPoint: false,
    crop: false,
    imageSizes: [
      {
        name: 'thumb',
        width: 400,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'feed',
        width: 1000,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'full',
        width: 2000,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
  },
  fields: [
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional. Shown under the photo and used as its alt text.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Permalink, derived from the capture time.',
      },
    },
    {
      name: 'capturedAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'legacySlug',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'The old Eleventy permalink, kept so /photo/<date_url>/ can redirect here.',
      },
    },
    {
      type: 'collapsible',
      label: 'EXIF',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'cameraMake', type: 'text', admin: { readOnly: true } },
            { name: 'cameraModel', type: 'text', admin: { readOnly: true } },
          ],
        },
        { name: 'lensModel', type: 'text', admin: { readOnly: true } },
        {
          type: 'row',
          fields: [
            { name: 'iso', type: 'number', admin: { readOnly: true } },
            { name: 'aperture', type: 'number', admin: { readOnly: true } },
            { name: 'shutterSpeed', type: 'text', admin: { readOnly: true } },
            { name: 'focalLength', type: 'number', admin: { readOnly: true } },
          ],
        },
        {
          name: 'gps',
          type: 'point',
          admin: {
            readOnly: true,
            description: 'Nothing renders this yet — captured now so a map view is possible later.',
          },
        },
      ],
    },
    {
      name: 'blurDataURL',
      type: 'text',
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        const buffer = req.file?.data

        // Only re-derive when a file actually arrived. Editing a caption on an
        // existing photo must not wipe the EXIF already on the record.
        if (buffer) {
          const exif = await extractExif(buffer)

          data.capturedAt = exif.capturedAt.toISOString()
          data.cameraMake = exif.cameraMake
          data.cameraModel = exif.cameraModel
          data.lensModel = exif.lensModel
          data.iso = exif.iso
          data.aperture = exif.aperture
          data.shutterSpeed = exif.shutterSpeed
          data.focalLength = exif.focalLength
          data.gps = exif.gps
          data.blurDataURL = await buildBlurDataURL(buffer)

          data.slug = await ensureUniqueSlug(
            req.payload,
            slugFromCapturedAt(exif.capturedAt),
            operation === 'update' ? originalDoc?.id : undefined,
          )
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (req.context?.disableRevalidate) return doc
        safeRevalidate(doc.slug)
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (req.context?.disableRevalidate) return doc
        safeRevalidate(doc.slug)
        return doc
      },
    ],
  },
}
