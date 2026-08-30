import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Feed } from '@/components/Feed'
import { getFeedPageCount } from '@/lib/queries'

type Props = { params: Promise<{ n: string }> }

export async function generateStaticParams() {
  const totalPages = await getFeedPageCount()
  // Page 1 is `/`, so numbered routes start at 2.
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({ n: String(i + 2) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { n } = await params
  return { title: `Page ${n}` }
}

export default async function FeedPaginated({ params }: Props) {
  const { n } = await params
  const page = Number(n)
  if (!Number.isInteger(page) || page < 2) notFound()
  return <Feed page={page} />
}
