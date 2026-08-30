import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PhotoImage } from '@/components/PhotoImage'
import { getAdjacentPhotos, getAllPhotoSlugs, getPhotoBySlug, isDraftMode } from '@/lib/queries'
import { exifSummary, formatLongDate, machineDate, SITE_TITLE } from '@/lib/site'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllPhotoSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const photo = await getPhotoBySlug(slug)
  if (!photo) return {}

  const date = formatLongDate(photo.capturedAt)
  const title = photo.caption || date || SITE_TITLE
  const description = photo.caption || `A photo taken on ${date}.`
  const image = photo.sizes?.feed?.url ?? photo.url ?? undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function PhotoPage({ params }: Props) {
  const { slug } = await params
  const draft = await isDraftMode()

  const photo = await getPhotoBySlug(slug, draft)
  if (!photo) notFound()

  const { previous, next } = await getAdjacentPhotos(photo)
  const exif = exifSummary(photo)

  return (
    <article className="photo-detail">
      <PhotoImage photo={photo} variant="full" sizes="(max-width: 48rem) 100vw, 46rem" priority />

      <div className="photo-meta">
        {photo.caption && <p className="photo-meta__date">{photo.caption}</p>}
        <p className="photo-meta__date">
          Taken on{' '}
          <time dateTime={machineDate(photo.capturedAt)}>{formatLongDate(photo.capturedAt)}</time>.
        </p>
        {exif.length > 0 && (
          <ul className="exif">
            {exif.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
        )}
      </div>

      <nav className="pager">
        {next ? (
          <Link href={`/photo/${next.slug}`}>← Newer</Link>
        ) : (
          <span className="pager__spacer">←</span>
        )}
        <Link href="/">All photos</Link>
        {previous ? (
          <Link href={`/photo/${previous.slug}`}>Older →</Link>
        ) : (
          <span className="pager__spacer">→</span>
        )}
      </nav>
    </article>
  )
}
