import { PHOTO_ICON_SIZE, renderPhotoIcon } from '@/lib/photo-icon'
import { getLatestPhoto, getPhotoBySlug } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateImageMetadata() {
  const photo = await getLatestPhoto()

  return [
    {
      id: photo?.slug ? `${photo.slug}|${photo.updatedAt}` : 'fallback',
      alt: 'Ezra Takes Photos',
      size: PHOTO_ICON_SIZE,
      contentType: 'image/png',
    },
  ]
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconID = String(await id)
  const separator = iconID.indexOf('|')
  const slug = separator === -1 ? undefined : iconID.slice(0, separator)
  const photo = slug ? await getPhotoBySlug(slug) : null
  const icon = await renderPhotoIcon(photo)

  return new Response(icon, {
    headers: { 'Content-Type': 'image/png' },
  })
}
