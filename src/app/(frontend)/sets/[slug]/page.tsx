import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PhotoImage } from '@/components/PhotoImage'
import { getStaticPhotoSources } from '@/generated/static-photo-sources'
import { getAllSetSlugs, getSetBySlug, isDraftMode } from '@/lib/queries'
import { formatLongDate, machineDate, SERVER_URL } from '@/lib/site'
import type { Photo } from '@/payload-types'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllSetSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const set = await getSetBySlug(slug)
  if (!set) return {}

  const photos = (set.photos ?? []).filter(
    (p): p is Photo => Boolean(p) && typeof p === 'object',
  )
  const firstPhoto = photos[0]
  const staticImage = firstPhoto
    ? getStaticPhotoSources(firstPhoto.legacySlug)?.large.src
    : undefined
  const image = staticImage
    ? new URL(staticImage, SERVER_URL).href
    : (firstPhoto?.sizes?.feed?.url ?? undefined)

  return {
    title: set.title,
    description: set.description ?? undefined,
    openGraph: {
      title: set.title,
      description: set.description ?? undefined,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function SetPage({ params }: Props) {
  const { slug } = await params
  const draft = await isDraftMode()

  const set = await getSetBySlug(slug, draft)
  if (!set) notFound()

  // Relationship order is the display order; unresolved ids are dropped.
  const photos = (set.photos ?? []).filter(
    (p): p is Photo => Boolean(p) && typeof p === 'object',
  )

  return (
    <>
      <header className="set-intro">
        <h1>{set.title}</h1>
        {set.description && <p>{set.description}</p>}
      </header>

      {photos.length === 0 ? (
        <p className="empty">Nothing in this set yet.</p>
      ) : (
        <div className="feed">
          {photos.map((photo, index) => (
            <article className="frame" key={photo.id}>
              <figure>
                <Link href={`/photo/${photo.slug}`}>
                  <PhotoImage
                    photo={photo}
                    variant="feed"
                    sizes="(max-width: 48rem) 100vw, 46rem"
                    priority={index === 0}
                  />
                </Link>
                <figcaption>
                  {photo.caption && <span className="frame__caption">{photo.caption}</span>}
                  <Link href={`/photo/${photo.slug}`}>
                    <time dateTime={machineDate(photo.capturedAt)}>
                      {formatLongDate(photo.capturedAt)}
                    </time>
                  </Link>
                </figcaption>
              </figure>
            </article>
          ))}
        </div>
      )}

      <nav className="pager">
        <Link href="/sets">← All sets</Link>
      </nav>
    </>
  )
}
