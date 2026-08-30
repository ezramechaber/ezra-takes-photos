import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { buildPreviewURL } from './lib/preview'
import { Users } from './collections/Users'
import { Photos } from './collections/Photos'
import { Sets } from './collections/Sets'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export default buildConfig({
  serverURL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' · Ezra Takes Photos',
    },
    livePreview: {
      // Without this list, live preview is enabled for no collection at all
      // and the "Live Preview" tab never appears.
      collections: ['photos', 'sets'],
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 390, height: 844 },
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
      url: ({ data, collectionConfig }) =>
        buildPreviewURL(collectionConfig?.slug === 'sets' ? 'sets' : 'photos', data?.slug),
    },
  },
  collections: [Users, Photos, Sets],
  // Originals off the OM-5 average ~6MB; the busboy default would reject them.
  bodyParser: {
    limits: { fileSize: 30 * 1024 * 1024 },
  },
  // Required peer of the admin bundle. Nothing on this site uses rich text.
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    // Payload Cloud injects DATABASE_URI; the local docker-compose uses the same name.
    url: process.env.DATABASE_URI || process.env.DATABASE_URL || '',
  }),
  sharp,
  // Wires up S3 uploads and email when running on Payload Cloud; a no-op locally.
  plugins: [payloadCloudPlugin()],
})
