import { describe, expect, it } from 'vitest'
import { applyRegeneratedResultToClip } from './buildClipFromGenerationNode'
import type { TimelineClip } from '../../timeline/timelineTypes'
const clip: TimelineClip = { id: 'cut', type: 'video', sourceNodeId: 'shot', label: 'Shot', startFrame: 90, endFrame: 180, frameCount: 150, offsetStartFrame: 30, offsetEndFrame: 30, url: 'old.mp4', audio: { gainDb: -6, muted: false, fadeInFrames: 8 }, framing: { fit: 'contain', scale: 1, offsetX: 0, offsetY: 0 } }
describe('explicit candidate replacement preserves the editorial source window', () => {
  it('a longer candidate does not extend the visible cut or change audio/framing', () => {
    const replaced = applyRegeneratedResultToClip(clip, { id: 'new', type: 'video', url: 'new.mp4', createdAt: 1, durationSeconds: 8 }, 30)
    expect(replaced).toMatchObject({ startFrame: 90, endFrame: 180, offsetStartFrame: 30, offsetEndFrame: 120, frameCount: 240, audio: clip.audio, framing: clip.framing })
  })
  it('a short candidate rejects replacement instead of shortening or moving the cut', () => {
    expect(() => applyRegeneratedResultToClip(clip, { id: 'short', type: 'video', url: 'short.mp4', createdAt: 1, durationSeconds: 2 }, 30)).toThrow('timeline_candidate_too_short')
    expect(clip.endFrame).toBe(180)
  })
})
