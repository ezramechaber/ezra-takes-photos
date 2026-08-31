import type { Metadata } from 'next'

import { Feed } from '@/components/Feed'
import {
  getPhotoShareImage,
  getPhotoSocialAlt,
  getPhotoTwitterCardURL,
  TWITTER_CARD_SIZE,
} from '@/lib/photo-social'
import { getLatestPhoto } from '@/lib/queries'
import { SERVER_URL, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site'

// Figma Cloud currently deploys ISR pages as year-cached static files, ignoring
// their revalidation interval. Keep the upload feed live until it supports ISR.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const photo = await getLatestPhoto()
  const canonicalURL = new URL('/', SERVER_URL).href
  const image = photo ? getPhotoShareImage(photo) : undefined
  const imageAlt = photo ? getPhotoSocialAlt(photo) : undefined
  const twitterImage = photo?.slug ? getPhotoTwitterCardURL(photo, photo.slug) : undefined

  return {
    alternates: {
      canonical: canonicalURL,
    },
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      type: 'website',
      url: canonicalURL,
      siteName: SITE_TITLE,
      images: image ? [{ ...image, alt: imageAlt }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      site: '@ezramechaber',
      creator: '@ezramechaber',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: twitterImage
        ? [
            {
              url: twitterImage,
              alt: imageAlt,
              type: 'image/jpeg',
              ...TWITTER_CARD_SIZE,
            },
          ]
        : undefined,
    },
  }
}

export default async function FeedPage() {
  return <Feed page={1} />
}
