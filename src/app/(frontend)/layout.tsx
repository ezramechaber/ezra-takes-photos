import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import Link from 'next/link'
import React from 'react'

import { RefreshOnSave } from '@/components/RefreshOnSave'
import { getPhotoCount } from '@/lib/queries'
import { SERVER_URL, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site'

import './styles.css'

export const metadata: Metadata = {
  metadataBase: new URL(SERVER_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_TITLE,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

// Preserve a bounded ISR interval for prerendered photo and set pages. Figma
// Cloud currently ignores it, so the upload feed separately forces dynamic.
export const revalidate = 30

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled: isDraft } = await draftMode()
  const count = await getPhotoCount()

  return (
    <html lang="en">
      <body>
        {isDraft && (
          <div className="draft-banner">
            Draft preview — showing unpublished changes.{' '}
            <a href="/preview/exit">Exit preview</a>
          </div>
        )}

        <div className="shell">
          <header className="masthead">
            <h1 className="masthead__title">
              <Link href="/">{SITE_TITLE}</Link>
            </h1>
            <nav className="masthead__nav">
              <Link href="/">Photos</Link>
              <Link href="/sets">Sets</Link>
            </nav>
          </header>

          <main>{children}</main>

          <footer className="colophon">
            <span>
              {count} photo{count === 1 ? '' : 's'}.
            </span>
            <span>By Ezra.</span>
          </footer>
        </div>

        {/* Mounted only in draft mode, so published pages ship none of our JS. */}
        {isDraft && <RefreshOnSave serverURL={SERVER_URL} />}
      </body>
    </html>
  )
}
