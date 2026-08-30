import config from '@payload-config'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'

import type { Photo, Set as PhotoSet } from '@/payload-types'

/**
 * Every read the public site makes lives in this file.
 *
 * That's deliberate. The photo library is the durable asset here; the front end
 * is meant to be cheap to throw away and rebuild in a different shape. Keeping
 * the data surface in one module means a future rewrite starts from a known
 * list of questions the site asks, rather than from a grep.
 */

export const FEED_PAGE_SIZE = 24

async function client() {
  return getPayload({ config })
}

/** True when the request came through /preview and Next draft mode is on. */
export async function isDraftMode(): Promise<boolean> {
  const { isEnabled } = await draftMode()
  return isEnabled
}

export type Feed = {
  photos: Photo[]
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export async function getFeed({ page = 1, draft = false }): Promise<Feed> {
  const payload = await client()
  const result = await payload.find({
    collection: 'photos',
    sort: '-capturedAt',
    limit: FEED_PAGE_SIZE,
    page,
    depth: 0,
    draft,
    overrideAccess: draft,
  })

  return {
    photos: result.docs,
    page: result.page ?? 1,
    totalPages: result.totalPages ?? 1,
    hasNextPage: Boolean(result.hasNextPage),
    hasPrevPage: Boolean(result.hasPrevPage),
  }
}

export async function getPhotoBySlug(slug: string, draft = false): Promise<Photo | null> {
  const payload = await client()
  const result = await payload.find({
    collection: 'photos',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    draft,
    overrideAccess: draft,
  })
  return result.docs[0] ?? null
}

/**
 * The old photo.njk found neighbours by looping the entire collection inside the
 * template on every single page render. These are two indexed queries instead.
 */
export async function getAdjacentPhotos(photo: Photo): Promise<{
  previous: Photo | null
  next: Photo | null
}> {
  if (!photo.capturedAt) return { previous: null, next: null }
  const payload = await client()

  const [older, newer] = await Promise.all([
    payload.find({
      collection: 'photos',
      where: { capturedAt: { less_than: photo.capturedAt } },
      sort: '-capturedAt',
      limit: 1,
      depth: 0,
    }),
    payload.find({
      collection: 'photos',
      where: { capturedAt: { greater_than: photo.capturedAt } },
      sort: 'capturedAt',
      limit: 1,
      depth: 0,
    }),
  ])

  return {
    previous: older.docs[0] ?? null,
    next: newer.docs[0] ?? null,
  }
}

/** Number of pages in the feed, for generateStaticParams on /page/[n]. */
export async function getFeedPageCount(): Promise<number> {
  const payload = await client()
  const { totalDocs } = await payload.count({ collection: 'photos' })
  return Math.max(1, Math.ceil(totalDocs / FEED_PAGE_SIZE))
}

export async function getPhotoCount(): Promise<number> {
  const payload = await client()
  const { totalDocs } = await payload.count({ collection: 'photos' })
  return totalDocs
}

export async function getSets(draft = false): Promise<PhotoSet[]> {
  const payload = await client()
  const result = await payload.find({
    collection: 'sets',
    sort: '-publishedAt',
    limit: 100,
    // One level deep so coverPhoto arrives populated for the index page.
    depth: 1,
    draft,
    overrideAccess: draft,
  })
  return result.docs
}

export async function getSetBySlug(slug: string, draft = false): Promise<PhotoSet | null> {
  const payload = await client()
  const result = await payload.find({
    collection: 'sets',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    draft,
    overrideAccess: draft,
  })
  return result.docs[0] ?? null
}

/** Slugs for generateStaticParams — published only, never drafts. */
export async function getAllPhotoSlugs(): Promise<string[]> {
  const payload = await client()
  const result = await payload.find({
    collection: 'photos',
    limit: 0,
    pagination: false,
    depth: 0,
    select: { slug: true },
  })
  return result.docs.map((doc) => doc.slug).filter((slug): slug is string => Boolean(slug))
}

export async function getAllSetSlugs(): Promise<string[]> {
  const payload = await client()
  const result = await payload.find({
    collection: 'sets',
    limit: 0,
    pagination: false,
    depth: 0,
    select: { slug: true },
  })
  return result.docs.map((doc) => doc.slug).filter((slug): slug is string => Boolean(slug))
}
