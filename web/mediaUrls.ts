/** Only this transport translates canonical Nomi media URLs to same-origin HTTP. */
export const WEB_MEDIA_PREFIX = '/api/media/'
export function translateMediaValues(value: unknown, direction: 'browser' | 'server'): unknown {
  if (typeof value === 'string') {
    if (direction === 'browser' && value.startsWith('nomi-local://asset/')) return `${WEB_MEDIA_PREFIX}${value.slice('nomi-local://asset/'.length)}`
    if (direction === 'server' && value.startsWith(WEB_MEDIA_PREFIX)) return `nomi-local://asset/${value.slice(WEB_MEDIA_PREFIX.length)}`
    return value
  }
  if (Array.isArray(value)) return value.map(item => translateMediaValues(item, direction))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateMediaValues(item, direction)]))
  return value
}
