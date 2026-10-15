import { describe, expect, it, vi } from 'vitest'
import { resolveMediaDeliveryUrl, toWebMediaDeliveryUrl } from './assetDeliveryUrl'

const canonical = 'nomi-local://asset/project-1/assets/generated/frame%20one.png?revision=2'

describe('project media delivery URL', () => {
  it('resolves renderer-built canonical media for web image, video, audio and poster consumers', () => {
    expect(toWebMediaDeliveryUrl(canonical, 'https://nomi.example')).toBe('https://nomi.example/api/media/project-1/assets/generated/frame%20one.png?revision=2')
    expect(toWebMediaDeliveryUrl('nomi-local://asset/project-1/assets/generated/movie.mp4', 'https://nomi.example')).toContain('/api/media/project-1/assets/generated/movie.mp4')
    expect(toWebMediaDeliveryUrl('nomi-local://asset/project-1/assets/generated/audio.wav', 'https://nomi.example')).toContain('/api/media/project-1/assets/generated/audio.wav')
  })
  it('is idempotent and leaves unsupported schemes and remote sources unchanged', () => {
    const delivered = 'https://nomi.example/api/media/project-1/assets/generated/frame.png'
    expect(toWebMediaDeliveryUrl(delivered, 'https://nomi.example')).toBe(delivered)
    expect(toWebMediaDeliveryUrl('nomi-local://production-preview/p/r', 'https://nomi.example')).toBe('nomi-local://production-preview/p/r')
    expect(toWebMediaDeliveryUrl('file:///tmp/frame.png', 'https://nomi.example')).toBe('file:///tmp/frame.png')
  })
  it('keeps desktop canonical identity at consumption', () => {
    vi.stubGlobal('window', { nomiDesktop: { platform: 'darwin' } })
    expect(resolveMediaDeliveryUrl(canonical)).toBe(canonical)
    vi.unstubAllGlobals()
  })
})
