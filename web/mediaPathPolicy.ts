const MEDIA_FILE = /\.(png|jpe?g|webp|gif|mp4|webm|mov|m4a|wav|mp3|ogg|flac)$/i
const OWNED_MEDIA = /^(?:assets\/|exports\/|\.nomi\/out\/|\.nomi\/cache\/(?:filmstrip|shot-cuts|audio-track)\/)/

/** Only project-owned media locations may cross the Web HTTP read boundary. */
export function projectMediaRelativePath(encodedPath: string, search = ''): string | null {
  if (search) return null
  try {
    const segments = encodedPath.split('/')
    if (segments.length < 3 || !segments[0]) return null
    const decoded = segments.map(decodeURIComponent)
    if (decoded.some(segment => !segment || segment === '.' || segment === '..' || /[\\/]/.test(segment))) return null
    const relativePath = decoded.slice(1).join('/')
    return OWNED_MEDIA.test(relativePath) && MEDIA_FILE.test(relativePath) ? relativePath : null
  } catch {
    return null
  }
}
