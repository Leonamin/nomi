import { describe, expect, it } from 'vitest'
import { translateMediaValues } from './mediaUrls'
import { resultUrl } from '../src/workbench/generationCanvas/runner/referenceUrl'
import { resolveTimelineClipPlaybackUrl } from '../src/workbench/timeline/timelinePlaybackUrl'
const origin = 'https://web.example.test'
const canonical = 'nomi-local://asset/project/assets/clip.mp4'
const browserUrl = `${origin}/api/media/project/assets/clip.mp4`
describe('canonical media transport', () => {
  it('keeps persisted local media preferred through shared reference and timeline URL owners', () => {
    const result = translateMediaValues({ id: 'r', type: 'video', createdAt: 1, url: canonical, providerUrl: 'http://127.0.0.1:19188/view' }, 'browser', origin) as never
    expect(resultUrl(result)).toBe(browserUrl)
    expect(resolveTimelineClipPlaybackUrl({ sourceNodeId: 'shot', url: browserUrl } as never, [{ id: 'shot', result }] as never)).toBe(browserUrl)
  })
  it('round-trips nested same-origin URLs but never rewrites another host', () => {
    const value = { timeline: [canonical], remote: 'https://other.example/api/media/project/assets/clip.mp4' }
    expect(translateMediaValues(translateMediaValues(value, 'browser', origin), 'server', origin)).toEqual(value)
    expect(translateMediaValues('/api/media/project/assets/clip.mp4', 'server', origin)).toBe(canonical)
  })
})
