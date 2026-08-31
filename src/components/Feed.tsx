import Link from 'next/link'

import { PhotoImage } from '@/components/PhotoImage'
import { getFeed, isDraftMode } from '@/lib/queries'
import { formatLongDate, machineDate } from '@/lib/site'

/**
 * Shared by `/` and `/page/[n]`.
 *
 * Pagination lives in the route rather than a ?page= search param so each page
 * has a stable, shareable URL. The route files currently force dynamic delivery
 * because Figma Cloud does not honor Next's ISR metadata for these pages.
 */
export async function Feed({ page }: { page: number }) {
  const draft = await isDraftMode()
  const { photos, totalPages, hasNextPage, hasPrevPage } = await getFeed({ page, draft })

  if (photos.length === 0) {
    return <p className="empty">No photos yet.</p>
  }

  const newerHref = page === 2 ? '/' : `/page/${page - 1}`

  return (
    <>
      <div className="feed">
        {photos.map((photo, index) => (
          <article className="frame" key={photo.id}>
            <figure>
              <Link href={`/photo/${photo.slug}`}>
                <PhotoImage
                  photo={photo}
                  variant="feed"
                  sizes="(max-width: 48rem) 100vw, 46rem"
                  // Only the first image is above the fold on any viewport.
                  priority={page === 1 && index === 0}
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

      {totalPages > 1 && (
        <nav className="pager">
          {hasPrevPage ? (
            <Link href={newerHref}>← Newer</Link>
          ) : (
            <span className="pager__spacer">←</span>
          )}
          <span>
            {page} / {totalPages}
          </span>
          {hasNextPage ? (
            <Link href={`/page/${page + 1}`}>Older →</Link>
          ) : (
            <span className="pager__spacer">→</span>
          )}
        </nav>
      )}
    </>
  )
}
