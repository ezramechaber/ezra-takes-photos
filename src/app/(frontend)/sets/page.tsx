import type { Metadata } from 'next'
import Link from 'next/link'

import { PhotoImage } from '@/components/PhotoImage'
import { getSets, isDraftMode } from '@/lib/queries'
import { formatShortDate } from '@/lib/site'
import type { Photo } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Sets',
  description: 'Curated groups of photos.',
}

/** coverPhoto is optional; fall back to the first photo in the set. */
function coverOf(set: { coverPhoto?: unknown; photos?: unknown }): Photo | null {
  const cover = set.coverPhoto
  if (cover && typeof cover === 'object') return cover as Photo

  const photos = set.photos
  if (Array.isArray(photos)) {
    const first = photos[0]
    if (first && typeof first === 'object') return first as Photo
  }
  return null
}

export default async function SetsPage() {
  const draft = await isDraftMode()
  const sets = await getSets(draft)

  if (sets.length === 0) {
    return <p className="empty">No sets yet.</p>
  }

  return (
    <ul className="set-grid">
      {sets.map((set) => {
        const cover = coverOf(set)
        const count = Array.isArray(set.photos) ? set.photos.length : 0

        return (
          <li className="set-card" key={set.id}>
            <Link href={`/sets/${set.slug}`}>
              {cover && (
                <PhotoImage
                  photo={cover}
                  variant="thumb"
                  sizes="(max-width: 48rem) 50vw, 220px"
                />
              )}
              <span className="set-card__title">{set.title}</span>
              <span className="set-card__meta">
                {count} photo{count === 1 ? '' : 's'}
                {set.publishedAt ? ` · ${formatShortDate(set.publishedAt)}` : ''}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
