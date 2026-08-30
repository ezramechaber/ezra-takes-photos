'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'

/**
 * The only client component on the site, and it renders nothing.
 *
 * Payload's admin embeds the site in an iframe and posts a message on every
 * edit; this listens for that and asks Next to re-render the server component
 * tree. The layout mounts it only when draft mode is on, so published pages
 * ship no client JavaScript of ours at all.
 */
export function RefreshOnSave({ serverURL }: { serverURL: string }) {
  const router = useRouter()
  return <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={serverURL} />
}
