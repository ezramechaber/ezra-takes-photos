import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PhotoImage } from '@/components/PhotoImage'
import {
  getPhotoShareImage,
  getPhotoSocialAlt,
  getPhotoTwitterCardURL,
  TWITTER_CARD_SIZE,
} from '@/lib/photo-social'
import { getAdjacentPhotos, getAllPhotoSlugs, getPhotoBySlug, isDraftMode } from '@/lib/queries'
import { exifSummary, formatLongDate, machineDate, SERVER_URL, SITE_TITLE } from '@/lib/site'

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
  const canonicalURL = new URL(`/photo/${slug}`, SERVER_URL).href
  const image = getPhotoShareImage(photo)
  const imageAlt = getPhotoSocialAlt(photo)
  const twitterImage = getPhotoTwitterCardURL(photo, slug)

  return {
    title,
    description,
    alternates: {
      canonical: canonicalURL,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonicalURL,
      siteName: SITE_TITLE,
      images: image ? [{ ...image, alt: imageAlt }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      site: '@ezramechaber',
      creator: '@ezramechaber',
      title,
      description,
      images: [
        {
          url: twitterImage,
          alt: imageAlt,
          type: 'image/jpeg',
          ...TWITTER_CARD_SIZE,
        },
      ],
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
