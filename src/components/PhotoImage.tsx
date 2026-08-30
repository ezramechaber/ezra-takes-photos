import type { Photo } from '@/payload-types'
import { getStaticPhotoSources } from '@/generated/static-photo-sources'

/**
 * Payload has already produced thumb/feed/full derivatives with sharp, so there
 * is nothing left for a runtime image optimizer to do — this is a plain <img>
 * with a srcset over sizes that already exist.
 *
 * It also replaces, in about ten lines of markup, all three of the things the
 * old site hand-rolled: the IntersectionObserver lazy-loader in base.njk
 * (now `loading="lazy"`), the /photos/blur/ derivative fetched over the network
 * (now an inline data URI), and the manual w520/w960 <noscript> fallback pair
 * (now srcset, which needs no JavaScript at all).
 */

type Props = {
  photo: Photo
  /** Largest size this image will ever be displayed at. */
  variant: 'thumb' | 'feed' | 'full'
  sizes: string
  priority?: boolean
  className?: string
}

export function PhotoImage({ photo, variant, sizes, priority = false, className }: Props) {
  const staticSources = getStaticPhotoSources(photo.legacySlug)
  const candidates = (['thumb', 'feed', 'full'] as const)
    .map((name) => photo.sizes?.[name])
    .filter((size) => size?.url && size?.width)

  const srcSet = staticSources
    ? `${staticSources.small.src} ${staticSources.small.width}w, ${staticSources.large.src} ${staticSources.large.width}w`
    : candidates.map((size) => `${size!.url} ${size!.width}w`).join(', ')

  // Portrait originals are only 1536px wide, so Payload declines to upscale them
  // to the 2000px `full` size and that key is simply absent. Step down to the
  // largest derivative that does exist rather than falling through to the
  // original, which is a 1.5-2MB JPEG.
  const largest = candidates.at(-1)
  const fallback = staticSources
    ? variant === 'thumb'
      ? staticSources.small.src
      : staticSources.large.src
    : (photo.sizes?.[variant]?.url ?? largest?.url ?? photo.url ?? undefined)

  if (!fallback) return null

  return (
    <img
      className={className}
      src={fallback}
      srcSet={srcSet || undefined}
      sizes={sizes}
      width={staticSources?.large.width ?? photo.width ?? undefined}
      height={staticSources?.large.height ?? photo.height ?? undefined}
      alt={photo.caption ?? ''}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      style={
        photo.blurDataURL
          ? {
              backgroundImage: `url(${photo.blurDataURL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    />
  )
}
