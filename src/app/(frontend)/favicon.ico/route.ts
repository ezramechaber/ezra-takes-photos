import { renderPhotoIcon } from '@/lib/photo-icon'
import { getLatestPhoto } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const photo = await getLatestPhoto()
  const icon = await renderPhotoIcon(photo)

  return new Response(icon, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Content-Type': 'image/png',
    },
  })
}
