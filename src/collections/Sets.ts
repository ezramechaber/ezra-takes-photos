import type { Access, CollectionConfig } from 'payload'
import { revalidatePath } from 'next/cache'

import { buildPreviewURL } from '../lib/preview'

const publishedUnlessAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const Sets: CollectionConfig = {
  slug: 'sets',
  labels: { singular: 'Set', plural: 'Sets' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', '_status'],
    description: 'A curated group of photos. Drag to reorder.',
    preview: (doc) => buildPreviewURL('sets', doc?.slug),
  },
  access: {
    read: publishedUnlessAuthenticated,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      // Deliberately a plain textarea, not Lexical. There is no writing on this
      // site and a rich text editor would only invite some.
      name: 'description',
      type: 'textarea',
      admin: { description: 'Optional. A sentence at most.' },
    },
    {
      name: 'photos',
      type: 'relationship',
      relationTo: 'photos',
      hasMany: true,
      admin: { description: 'Order here is the order on the page.' },
    },
    {
      name: 'coverPhoto',
      type: 'relationship',
      relationTo: 'photos',
      admin: {
        position: 'sidebar',
        description: 'Defaults to the first photo in the set.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !data.slug && typeof data.title === 'string') {
          data.slug = slugify(data.title)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (req.context?.disableRevalidate) return doc
        for (const path of ['/sets', `/sets/${doc.slug}`]) {
          try {
            revalidatePath(path, 'page')
          } catch {
            // Outside a Next request context.
          }
        }
        return doc
      },
    ],
  },
}
