export const PRODUCTION_SERVER_URL = 'https://ezratakes.photos'
export const FIGMA_SITE_URL = 'https://ezra-takes-photos.figma.site'

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.NODE_ENV === 'production' ? PRODUCTION_SERVER_URL : 'http://localhost:3000')
