import sharp from 'sharp'

import { getPhotoShareImage, TWITTER_CARD_SIZE } from '@/lib/photo-social'
import { getPhotoBySlug } from '@/lib/queries'

type Context = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params
  const photo = await getPhotoBySlug(slug)
  if (!photo) return new Response('Photo not found', { status: 404 })

  const source = getPhotoShareImage(photo)
  if (!source) return new Response('Photo image not found', { status: 404 })

  const sourceResponse = await fetch(source.url)
  if (!sourceResponse.ok) {
    return new Response('Photo image unavailable', { status: 502 })
  }

  const input = Buffer.from(await sourceResponse.arrayBuffer())
  const image = sharp(input, { failOn: 'warning' }).rotate()

  const [background, foreground] = await Promise.all([
    image
      .clone()
      .resize({ ...TWITTER_CARD_SIZE, fit: 'cover' })
      .blur(36)
      .modulate({ brightness: 0.58, saturation: 0.8 })
      .jpeg({ quality: 82 })
      .toBuffer(),
    image
      .clone()
      .resize({
        ...TWITTER_CARD_SIZE,
        fit: 'contain',
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
  ])

  const card = await sharp(background)
    .composite([{ input: foreground, gravity: 'center' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()

  return new Response(new Uint8Array(card), {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      'Content-Length': String(card.byteLength),
      'Content-Type': 'image/jpeg',
    },
  })
}
