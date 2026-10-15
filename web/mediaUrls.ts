import { canonicalMediaAssetUrl, toWebMediaDeliveryUrl, WEB_MEDIA_PREFIX } from '../src/media/assetDeliveryUrl'

/** Translate persisted canonical media over the Web RPC transport. */
export { WEB_MEDIA_PREFIX }
export function translateMediaValues(value: unknown, direction: 'browser' | 'server', origin: string): unknown {
  if (typeof value === 'string') {
    if (direction === 'browser') return toWebMediaDeliveryUrl(value, origin)
    if (direction === 'server') return canonicalMediaAssetUrl(value, origin)
    return value
  }
  if (Array.isArray(value)) return value.map(item => translateMediaValues(item, direction, origin))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateMediaValues(item, direction, origin)]))
  return value
}
