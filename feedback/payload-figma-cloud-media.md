# Feedback: Payload media on Figma Cloud

Date: August 31, 2026

## Context

We migrated a small photography site to Payload on Figma Cloud. The production
app uses Next.js 16.3, Payload 4.0.0-canary.29, and `@payloadcms/figma`
0.1.0-alpha.6. It has a custom domain, 126 published photos, and three generated
image sizes (400, 1000, and 2000 pixels wide).

The individual pieces mostly worked, but getting from “the upload exists in the
CMS” to “the photo appears promptly and loads efficiently on the public site”
required several Figma Cloud-specific workarounds. This is the path we observed.

## 1. Cross-origin uploads failed by default

The Payload admin was served from the managed Figma Site origin while its API
requests targeted the custom `serverURL`. Upload creation failed at the browser
preflight:

```text
Access to fetch at 'https://ezratakes.photos/api/upload-instructions'
from origin 'https://ezra-takes-photos.figma.site' has been blocked by CORS
policy: No 'Access-Control-Allow-Origin' header is present.
```

We fixed it by adding the managed Figma origin to both `cors` and `csrf` in the
Payload config.

Suggested improvements:

- Have `buildFigmaConfig` automatically trust the app's managed Figma origin
  when `serverURL` points at a custom domain, or generate the required config
  during initialization.
- Validate this pairing during deploy and emit a targeted warning before a user
  discovers it through a generic `Failed to fetch` error.
- Document the custom-domain plus managed-admin case with a complete example.

## 2. A successful publish did not update the public feed

The upload and database record succeeded and were immediately visible in the
Payload backend, but the public feed continued returning the old result. The
site had a 30-second Next.js revalidation interval and called `revalidatePath`
from the photo collection's hooks. In production, the feed was still served as
a long-lived static artifact and did not refresh on either signal.

We restored correctness by forcing the homepage and paginated feed routes to be
dynamic. That makes new photos visible immediately, but it gives up the intended
ISR performance model.

Suggested improvements:

- Support Next.js ISR intervals and on-demand path revalidation in Figma Cloud,
  or clearly document that these semantics are not currently available.
- Warn during build or deploy when a route declares ISR behavior that the
  platform will not honor.
- Provide a platform-supported invalidation API or hook for CMS publish events.

## 3. Published media is not cached at the Figma edge

A request for a public generated image currently returns a dynamic redirect to
a signed S3 URL instead of image bytes:

```text
HTTP/2 302
cf-cache-status: BYPASS
x-gk: DYNAMIC
location: https://...s3.us-east-1.amazonaws.com/...?...signature...
```

The resize work is already done, which is good, but each visitor still reaches
the dynamic Payload/Lambda path to mint a signed URL. The installed Figma
storage adapter also returns this redirect before app-level media response
headers can provide a useful public cache policy.

For published, access-controlled media, we would expect the first authorized
request to populate an edge cache and later requests to return a stable cached
response. Draft or private media should remain uncached.

Suggested improvements:

- Complete the Gatekeeper media proxy so it validates the Payload response,
  follows the storage redirect, and serves the object through the Figma edge.
- Forward Payload or storage `Cache-Control` behavior through that path.
- Define purge/versioning behavior for replace, unpublish, and delete events.
- Expose understandable cache headers so developers can tell whether the media
  path is operating as intended.

## 4. Next Image cannot consume the deployed media URL

Using a relative Payload media URL with Next's `<Image>` component failed in the
deployed app:

```text
400: "url" parameter is valid but internal response is invalid
```

The internal Next image optimizer receives the Lambda's 302 response before
Gatekeeper has a chance to turn it into image bytes. The same media URL works
when requested directly by the browser, so this is a platform integration gap
rather than an invalid image.

Suggested improvements:

- Make Payload media URLs work with the standard Next Image optimizer in the
  deployed environment.
- Until that is possible, ship a supported Figma Cloud image loader or URL
  resolver and document when it is required.
- Add an end-to-end test covering `<Image src="/api/.../file/...">` against the
  Lambda plus Gatekeeper production path.

## 5. The Figma image-size type and the Payload runtime disagree

We intended all three generated sizes to be WebP and configured `format` and
`quality` directly on each image-size entry. This was not merely an untyped or
legacy configuration: `@payloadcms/figma` augments Payload's `ImageSize` type
with `CloudflareImageSizeOptions`, where both keys are explicitly supported.
The app type-checked, built, and deployed, but the live derivatives were JPEG.

Payload's Sharp runtime does not read those Cloudflare-style keys. It requires:

```ts
formatOptions: {
  format: 'webp',
  options: { quality: 82 },
}
```

However, once the Figma module augmentation is loaded, TypeScript rejects
`formatOptions` because Figma's registered image-size options replace Payload's
`SharpImageSizeOptions`. The type-level Figma contract and the runtime Payload
processor therefore have no shared, supported way to request WebP.

Our temporary workaround is to supply both shapes through an explicit
`CloudflareImageSizeOptions & SharpImageSizeOptions` intersection. That lets the
Figma-facing configuration retain `format` and `quality` while the current
Sharp path receives `formatOptions`. It should not be necessary in application
code.

Suggested improvements:

- Make the Figma image processor honor the Cloudflare-style options its package
  registers, or map them to the Sharp options before Payload generates sizes.
- If Sharp remains part of the Figma runtime, preserve `SharpImageSizeOptions`
  in the augmented type instead of replacing them.
- Add an end-to-end Figma Cloud upload test that requests WebP, then checks the
  stored filename, MIME type, and file signature rather than only the schema.
- Document which processor owns image resizing locally and after deployment.
- Provide a documented command or job for regenerating derivatives after an
  image-size or format change. This is essential because correcting the config
  only affects future uploads.

## What worked well

- Once CORS and CSRF were configured, direct uploads were reliable.
- Payload generated all requested widths and recorded accurate URLs, dimensions,
  MIME types, and file sizes.
- The admin and REST data made it straightforward to confirm that a publish had
  succeeded independently of the stale frontend.
- The generated blur placeholder made it possible to keep the feed visually
  stable while the full display image loaded.

## A good end state

For this workflow, the happy path would be:

1. Adding a custom domain does not break uploads from the managed admin origin.
2. Publishing a photo invalidates the affected public routes.
3. Public media reaches the browser through a cacheable Figma edge URL.
4. The same URL works with the standard Next Image component.
5. The typed image configuration produces the same format locally and in Figma
   Cloud, and existing derivatives have a supported regeneration path.

That would let a Payload developer use the framework's standard upload,
revalidation, and image components without needing to understand the boundaries
between Next's optimizer, the Payload Lambda, signed S3 redirects, and
Gatekeeper.
