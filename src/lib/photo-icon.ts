import sharp from 'sharp'

import type { Photo } from '@/payload-types'

import { getPhotoShareImage } from './photo-social'

export const PHOTO_ICON_SIZE = {
  width: 64,
  height: 64,
} as const

async function fallbackIcon(): Promise<Uint8Array> {
  const icon = await sharp({
    create: {
      ...PHOTO_ICON_SIZE,
      channels: 3,
      background: '#111111',
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()

  return new Uint8Array(icon)
}

export async function renderPhotoIcon(photo?: Photo | null): Promise<Uint8Array> {
  const source = photo ? getPhotoShareImage(photo) : undefined
  if (!source) return fallbackIcon()

  try {
    const response = await fetch(source.url)
    if (!response.ok) return fallbackIcon()

    const icon = await sharp(Buffer.from(await response.arrayBuffer()), { failOn: 'warning' })
      .rotate()
      .resize({
        ...PHOTO_ICON_SIZE,
        fit: 'cover',
        position: sharp.strategy.attention,
      })
      .png({ compressionLevel: 9 })
      .toBuffer()

    return new Uint8Array(icon)
  } catch {
    return fallbackIcon()
  }
}
