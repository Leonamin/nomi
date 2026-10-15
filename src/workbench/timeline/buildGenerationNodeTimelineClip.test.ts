import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readAudioDurationSeconds } from '../../media/audioDurationProbe'
import type { GenerationCanvasNode } from '../generationCanvas/model/generationCanvasTypes'
import { buildGenerationNodeTimelineClip } from './buildGenerationNodeTimelineClip'

vi.mock('../../media/videoDurationProbe', () => ({
  readVideoDurationSeconds: vi.fn(async () => 7),
}))

vi.mock('../../media/audioDurationProbe', () => ({
  readAudioDurationSeconds: vi.fn(async () => 4.1),
}))

function videoNode(overrides: Partial<GenerationCanvasNode> = {}): GenerationCanvasNode {
  return {
    id: 'node-1',
    kind: 'video',
    title: 'shot',
    position: { x: 0, y: 0 },
    result: { id: 'result-1', type: 'video', url: 'nomi-local://asset/project/video.mp4', createdAt: 1 },
    ...overrides,
  }
}

describe('buildGenerationNodeTimelineClip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('probes an audio file when result and node metadata contain no duration', async () => {
    const node = videoNode({
      kind: 'audio', categoryId: 'shots',
      result: { id: 'audio-result', type: 'audio', url: 'nomi-local://asset/project/voice.mp3', createdAt: 1 },
    })
    const clip = await buildGenerationNodeTimelineClip(node, { fps: 30, startFrame: 12 })
    expect(readAudioDurationSeconds).toHaveBeenCalledWith('nomi-local://asset/project/voice.mp3')
    expect(clip).toMatchObject({ type: 'audio', frameCount: 123, startFrame: 12, endFrame: 135 })
  })

  it('probes a selected historical audio result instead of using current result metadata', async () => {
    const node = videoNode({
      kind: 'audio', categoryId: 'shots',
      result: { id: 'current-audio', type: 'audio', url: 'nomi-local://asset/project/current.mp3', createdAt: 1 },
      history: [{ id: 'older-audio', type: 'audio', url: 'nomi-local://asset/project/older.mp3', createdAt: 0 }],
      meta: { durationSec: 3.244603 },
    })
    const clip = await buildGenerationNodeTimelineClip(node, { fps: 30, resultId: 'older-audio' })
    expect(readAudioDurationSeconds).toHaveBeenCalledWith('nomi-local://asset/project/older.mp3')
    expect(clip).toMatchObject({ type: 'audio', frameCount: 123 })
  })

  it('keeps the existing fallback when an unknown audio file duration cannot be measured', async () => {
    vi.mocked(readAudioDurationSeconds).mockResolvedValueOnce(null)
    const node = videoNode({
      kind: 'audio', categoryId: 'shots',
      result: { id: 'audio-result', type: 'audio', url: 'nomi-local://asset/project/unmeasured.mp3', createdAt: 1 },
    })
    const clip = await buildGenerationNodeTimelineClip(node, { fps: 30 })
    expect(clip).toMatchObject({ type: 'audio', frameCount: 150 })
  })

  it('uses valid audio metadata without a redundant file probe', async () => {
    const node = videoNode({
      kind: 'audio', categoryId: 'shots',
      result: { id: 'audio-result', type: 'audio', url: 'nomi-local://asset/project/voice.mp3', createdAt: 1 },
      meta: { durationSec: 3.244603 },
    })
    const clip = await buildGenerationNodeTimelineClip(node, { fps: 30 })
    expect(readAudioDurationSeconds).not.toHaveBeenCalled()
    expect(clip).toMatchObject({ type: 'audio', frameCount: 97 })
  })

  it('probes a generated video duration before inserting when result duration is missing', async () => {
    const clip = await buildGenerationNodeTimelineClip(videoNode(), { fps: 30, startFrame: 10 })

    expect(clip?.frameCount).toBe(210)
    expect(clip?.startFrame).toBe(10)
    expect(clip?.endFrame).toBe(220)
  })

  it('prefers the current media file duration even when result duration is already available', async () => {
    const clip = await buildGenerationNodeTimelineClip(
      videoNode({ result: { id: 'result-1', type: 'video', url: 'nomi-local://asset/project/video.mp4', durationSeconds: 3, createdAt: 1 } }),
      { fps: 30, startFrame: 0 },
    )

    expect(clip?.frameCount).toBe(210)
    expect(clip?.endFrame).toBe(210)
  })

  it('prefers the current media file duration over a stale result duration', async () => {
    const clip = await buildGenerationNodeTimelineClip(
      videoNode({ result: { id: 'result-1', type: 'video', url: 'nomi-local://asset/project/video.mp4', durationSeconds: 5, createdAt: 1 } }),
      { fps: 30, startFrame: 0 },
    )

    expect(clip?.frameCount).toBe(210)
    expect(clip?.endFrame).toBe(210)
  })
})
