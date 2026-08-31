import type { Photo } from '@/payload-types'
import { getStaticPhotoSources } from '@/generated/static-photo-sources'

import { SERVER_URL } from './server-url'

export const TWITTER_CARD_SIZE = {
  width: 1200,
  height: 630,
} as const

export type PhotoShareImage = {
  url: string
  width?: number
  height?: number
  type?: string
}

export function getPhotoShareImage(photo: Photo): PhotoShareImage | undefined {
  const staticImage = getStaticPhotoSources(photo.legacySlug)?.large
  if (staticImage) {
    return {
      url: new URL(staticImage.src, SERVER_URL).href,
      width: staticImage.width,
      height: staticImage.height,
      type: 'image/jpeg',
    }
  }

  const payloadImage = photo.sizes?.feed?.url
    ? photo.sizes.feed
    : photo.sizes?.full?.url
      ? photo.sizes.full
      : photo.url
        ? photo
        : undefined

  if (!payloadImage?.url) return undefined

  return {
    url: new URL(payloadImage.url, SERVER_URL).href,
    width: payloadImage.width ?? undefined,
    height: payloadImage.height ?? undefined,
    type: payloadImage.mimeType ?? undefined,
  }
}

export function getPhotoSocialAlt(photo: Photo): string {
  return photo.caption || 'A photograph by Ezra.'
}

export function getPhotoTwitterCardURL(photo: Photo, slug: string): string {
  const url = new URL(`/photo/${slug}/twitter-card`, SERVER_URL)
  url.searchParams.set('v', photo.updatedAt)
  return url.href
}
