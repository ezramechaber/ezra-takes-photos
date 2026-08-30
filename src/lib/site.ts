import type { Photo } from '@/payload-types'

export { SERVER_URL } from './server-url'

export const SITE_TITLE = 'Ezra Takes Photos'
export const SITE_DESCRIPTION = 'Sometimes, photos.'

/**
 * Capture times are stored as UTC-anchored wall clock (see lib/exif.ts), so
 * they must be formatted in UTC too — otherwise a photo taken at 9am reads as
 * 4am to a server in a different zone. The old site did the same thing via
 * Luxon's `zone: 'utc'` in every filter in .eleventy.js.
 */
const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatLongDate(value?: string | null): string {
  if (!value) return ''
  return LONG_DATE.format(new Date(value))
}

export function formatShortDate(value?: string | null): string {
  if (!value) return ''
  return SHORT_DATE.format(new Date(value))
}

/** `2020-02-12` — for the <time datetime> attribute. */
export function machineDate(value?: string | null): string {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

/** The EXIF line under a photo. Omits anything the camera didn't record. */
export function exifSummary(photo: Photo): string[] {
  const parts: string[] = []
  if (photo.cameraModel) parts.push(photo.cameraModel)
  if (photo.lensModel) parts.push(photo.lensModel)
  if (photo.focalLength) parts.push(`${photo.focalLength}mm`)
  if (photo.aperture) parts.push(`ƒ/${photo.aperture}`)
  if (photo.shutterSpeed) parts.push(photo.shutterSpeed)
  if (photo.iso) parts.push(`ISO ${photo.iso}`)
  return parts
}
