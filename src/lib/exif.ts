import exifr from 'exifr'
import sharp from 'sharp'
import { APIError } from 'payload'

/**
 * Replaces the old Eleventy pipeline's utils/GetDateFromPhoto.js and the
 * extraction half of utils/FrontMatter.js.
 *
 * The important difference: the old helpers used `fast-exif`, which reads from
 * a file path. Uploads now stream to S3 and never touch a local disk, so
 * everything here works from the in-memory Buffer on `req.file.data`.
 */

export type ExtractedExif = {
  capturedAt: Date
  cameraMake?: string
  cameraModel?: string
  lensModel?: string
  iso?: number
  aperture?: number
  shutterSpeed?: string
  focalLength?: number
  /** Payload `point` fields are [longitude, latitude]. */
  gps?: [number, number]
}

/**
 * EXIF DateTimeOriginal carries no timezone — it's the camera's wall clock.
 * exifr revives it into a Date using the *host's* timezone, which would make
 * slugs differ between a laptop in ET and a container in UTC.
 *
 * So we take the wall-clock components back out and re-anchor them to UTC.
 * The stored instant is then unambiguous, and formatting with UTC getters
 * anywhere returns exactly what the camera recorded. This also matches what
 * the old site did — every Luxon call in .eleventy.js passed `zone: 'utc'`.
 */
function wallClockToUTC(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    ),
  )
}

/**
 * The old code stored `1/ExposureTime` as a bare number, so 1/125s became
 * "125" and a 2-second exposure became "0.5" — meaningless. Format it as
 * something displayable instead, handling both fast and slow shutters.
 */
function formatShutterSpeed(exposureTime: unknown): string | undefined {
  if (typeof exposureTime !== 'number' || !Number.isFinite(exposureTime) || exposureTime <= 0) {
    return undefined
  }
  if (exposureTime >= 1) return `${Number(exposureTime.toFixed(1))}s`
  return `1/${Math.round(1 / exposureTime)}`
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Extends Payload's APIError, not plain Error: Payload turns unrecognised
 * errors into a generic 500 "Something went wrong." An APIError with
 * isPublic=true is what actually shows the reason in the admin UI.
 */
export class MissingCaptureDateError extends APIError {
  constructor() {
    super(
      'This photo has no EXIF capture date, so it has no date to sort or link by. ' +
        'Add one with `exiftool -DateTimeOriginal="YYYY:MM:DD HH:MM:SS" file.jpg` and upload again.',
      400,
      undefined,
      true,
    )
  }
}

export async function extractExif(buffer: Buffer): Promise<ExtractedExif> {
  // `tiff: true` pulls in the ifd0 block (Make/Model); exif and gps are
  // separate blocks within it. mergeOutput defaults on, so the result is flat.
  const raw = await exifr.parse(buffer, {
    tiff: true,
    exif: true,
    gps: true,
  })

  const captured = raw?.DateTimeOriginal ?? raw?.CreateDate
  if (!(captured instanceof Date) || Number.isNaN(captured.valueOf())) {
    // Loud, not silent. The old pipeline swallowed this case in a console.error
    // inside an unawaited forEach, which is why 109 originals became 104 posts.
    throw new MissingCaptureDateError()
  }

  const latitude = asNumber(raw?.latitude)
  const longitude = asNumber(raw?.longitude)

  return {
    capturedAt: wallClockToUTC(captured),
    cameraMake: asString(raw?.Make),
    cameraModel: asString(raw?.Model),
    lensModel: asString(raw?.LensModel),
    iso: asNumber(raw?.ISO),
    aperture: asNumber(raw?.FNumber),
    shutterSpeed: formatShutterSpeed(raw?.ExposureTime),
    focalLength: asNumber(raw?.FocalLength),
    gps: latitude !== undefined && longitude !== undefined ? [longitude, latitude] : undefined,
  }
}

/**
 * A ~16px wide WebP as a data URI, shown behind the real image while it loads.
 * Replaces the 20px Jimp blur derivative the old pipeline wrote to /photos/blur/,
 * except it lives in the document instead of costing a network round trip.
 */
export async function buildBlurDataURL(buffer: Buffer): Promise<string | undefined> {
  try {
    const blurred = await sharp(buffer)
      .resize(16, null, { fit: 'inside' })
      .webp({ quality: 45 })
      .toBuffer()
    return `data:image/webp;base64,${blurred.toString('base64')}`
  } catch {
    // A missing placeholder is a cosmetic loss; never fail an upload over it.
    return undefined
  }
}

/** Canonical permalink slug: `2020-02-12-090441`, UTC, 24-hour. */
export function slugFromCapturedAt(capturedAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    capturedAt.getUTCFullYear(),
    pad(capturedAt.getUTCMonth() + 1),
    pad(capturedAt.getUTCDate()),
  ].join('-') +
    '-' +
    [
      pad(capturedAt.getUTCHours()),
      pad(capturedAt.getUTCMinutes()),
      pad(capturedAt.getUTCSeconds()),
    ].join('')
}
