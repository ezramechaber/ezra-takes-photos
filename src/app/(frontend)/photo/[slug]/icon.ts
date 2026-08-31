import { PHOTO_ICON_SIZE, renderPhotoIcon } from '@/lib/photo-icon'
import { getPhotoBySlug } from '@/lib/queries'

export const dynamic = 'force-dynamic'

type Params = {
  slug: string
}

export async function generateImageMetadata({ params }: { params: Params }) {
  const photo = await getPhotoBySlug(params.slug)

  return [
    {
      id: photo?.updatedAt ?? 'missing',
      alt: photo?.caption || 'A photograph by Ezra.',
      size: PHOTO_ICON_SIZE,
      contentType: 'image/png',
    },
  ]
}

export default async function Icon({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const photo = await getPhotoBySlug(slug)
  const icon = await renderPhotoIcon(photo)

  return new Response(icon, {
    headers: { 'Content-Type': 'image/png' },
  })
}
