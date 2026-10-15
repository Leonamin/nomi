import { describe, expect, it } from 'vitest'
import { projectMediaRelativePath } from './mediaPathPolicy'

describe('Web project media read policy', () => {
  it.each([
    'project/assets/generated/frame.png',
    'project/exports/movie.mp4',
    'project/.nomi/out/shot-1.mp4',
    'project/.nomi/cache/filmstrip/strip.jpg',
    'project/.nomi/cache/shot-cuts/frame.png',
    'project/.nomi/cache/audio-track/music.wav',
  ])('serves owned media %s', path => expect(projectMediaRelativePath(path)).toBe(path.slice(path.indexOf('/') + 1)))
  it.each([
    'project/.nomi/memory.json',
    'project/.nomi/jobs/receipt.mp4',
    'project/.nomi/cache/credentials/key.png',
    'project/assets/%2e%2e/.nomi/jobs/receipt.mp4',
    'project/assets/generated%2F..%2Fsecret.png',
    'project/assets/frame.svg',
  ])('rejects non-media or private paths %s', path => expect(projectMediaRelativePath(path)).toBeNull())
  it('does not reinterpret a query as a different project asset', () => {
    expect(projectMediaRelativePath('project/assets/frame.png', '?revision=2')).toBeNull()
  })
})
