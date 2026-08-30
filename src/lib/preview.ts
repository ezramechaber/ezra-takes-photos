import { SERVER_URL } from './server-url'

/**
 * Builds the /preview URL used by both the admin's Preview button
 * (collection `admin.preview`) and the live preview iframe
 * (`admin.livePreview.url` in payload.config.ts).
 *
 * Kept free of any Next imports so it is safe to pull into the Payload config.
 */
export function buildPreviewURL(collection: 'photos' | 'sets', slug: unknown): string {
  const params = new URLSearchParams({
    secret: process.env.PREVIEW_SECRET || '',
    collection,
    slug: typeof slug === 'string' ? slug : '',
  })
  return `${SERVER_URL}/preview?${params.toString()}`
}
