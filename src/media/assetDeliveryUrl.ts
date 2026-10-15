import { getDesktopBridge } from '../desktop/bridge'

const CANONICAL_ASSET_PREFIX = 'nomi-local://asset/'
export const WEB_MEDIA_PREFIX = '/api/media/'

/** Resolve a project asset for the Web host without changing its stored identity. */
export function toWebMediaDeliveryUrl(url: string, origin: string): string {
  return url.startsWith(CANONICAL_ASSET_PREFIX)
    ? `${origin}${WEB_MEDIA_PREFIX}${url.slice(CANONICAL_ASSET_PREFIX.length)}`
    : url
}

/** Recover project asset identity from this host's delivered URL. */
export function canonicalMediaAssetUrl(url: string, origin: string): string {
  const absolutePrefix = `${origin}${WEB_MEDIA_PREFIX}`
  if (url.startsWith(absolutePrefix)) return `${CANONICAL_ASSET_PREFIX}${url.slice(absolutePrefix.length)}`
  if (url.startsWith(WEB_MEDIA_PREFIX)) return `${CANONICAL_ASSET_PREFIX}${url.slice(WEB_MEDIA_PREFIX.length)}`
  return url
}

/** Use immediately before browser media loading or decoding, never for persistence. */
export function resolveMediaDeliveryUrl(url: string): string {
  if (getDesktopBridge()?.platform !== 'web') return url
  return toWebMediaDeliveryUrl(url, window.location.origin)
}
