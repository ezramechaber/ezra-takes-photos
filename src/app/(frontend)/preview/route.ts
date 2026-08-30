import config from '@payload-config'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { timingSafeEqual } from 'crypto'

/**
 * Entry point for both live preview and the admin's "Preview" button.
 *
 * Deliberately at /preview rather than /api/preview: Payload owns /api/[...slug]
 * in the (payload) route group, and a second route group also serving /api/*
 * is a routing collision waiting to happen.
 */

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const collection = searchParams.get('collection')
  const slug = searchParams.get('slug')

  const expected = process.env.PREVIEW_SECRET
  if (!expected) {
    return new Response('PREVIEW_SECRET is not configured.', { status: 500 })
  }
  if (!secret || !secretsMatch(secret, expected)) {
    return new Response('Invalid preview secret.', { status: 401 })
  }

  // The shared secret travels in a URL and could leak through a referrer or a
  // shoulder. Require a real Payload session too, so a leaked link alone can't
  // expose unpublished work.
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    return new Response('You must be logged in to preview drafts.', { status: 401 })
  }

  const draft = await draftMode()
  draft.enable()

  if (!slug) redirect('/')
  redirect(collection === 'sets' ? `/sets/${slug}` : `/photo/${slug}`)
}
