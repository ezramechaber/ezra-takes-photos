import { Feed } from '@/components/Feed'

// Figma Cloud currently deploys ISR pages as year-cached static files, ignoring
// their revalidation interval. Keep the upload feed live until it supports ISR.
export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  return <Feed page={1} />
}
