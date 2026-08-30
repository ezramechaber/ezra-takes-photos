import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import path from 'path'
import sharp from 'sharp'
import { buildFigmaConfig } from '@payloadcms/figma'
import { fileURLToPath } from 'url'
import { buildPreviewURL } from './lib/preview'
import { Users } from './collections/Users'
import { Photos } from './collections/Photos'
import { Sets } from './collections/Sets'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export default buildFigmaConfig({
  serverURL,
  sharp,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' · Ezra Takes Photos',
    },
    livePreview: {
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
  bodyParser: {
    limits: { fileSize: 30 * 1024 * 1024 },
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  plugins: [
    payloadCloudPlugin(),
    mcpPlugin({
      collections: {
        photos: {
          description: 'Published and draft photographs for Ezra Takes Photos.',
          tools: {
            delete: false,
            duplicate: false,
            restoreVersion: false,
          },
        },
        sets: {
          description: 'Curated, ordered groups of photographs.',
          tools: {
            delete: false,
            duplicate: false,
            restoreVersion: false,
          },
        },
        users: {
          tools: {
            count: false,
            create: false,
            delete: false,
            find: false,
            findDistinct: false,
            getCollectionSchema: false,
            update: false,
          },
        },
      },
      mcp: {
        serverOptions: {
          serverInfo: {
            name: 'ezra-takes-photos',
            version: '1.0.0',
          },
        },
      },
    }),
  ],
  figma: {},
})
