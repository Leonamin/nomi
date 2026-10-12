import { describe, it, expect } from 'vitest'
import { buildClipFromGenerationNode, applyRegeneratedResultToClip } from './buildClipFromGenerationNode'
import type { GenerationCanvasNode, GenerationNodeResult } from './generationCanvasTypes'
import type { TimelineClip } from '../../timeline/timelineTypes'

function makeNode(result: Partial<GenerationNodeResult> | null): GenerationCanvasNode {
  return {
    id: 'node-1',
    kind: 'image',
    title: '开场镜头',
    position: { x: 0, y: 0 },
    status: 'idle',
    result: result
      ? { id: 'r1', type: 'image', createdAt: 1, ...result }
      : undefined,
  }
}

describe('buildClipFromGenerationNode URL 口径（本地 url 优先）', () => {
  it('只有 providerUrl（url/thumbnail 都空）也能成 clip——这是修复前会被静默丢的坑', () => {
    const clip = buildClipFromGenerationNode(makeNode({ providerUrl: 'https://cdn.example.com/a.png' }))
    expect(clip).not.toBeNull()
    expect(clip?.url).toBe('https://cdn.example.com/a.png')
  })

  it('url 优先于 providerUrl，避免时间轴播放 ComfyUI 私网源被 CSP 拦截', () => {
    const clip = buildClipFromGenerationNode(
      makeNode({ providerUrl: 'https://cdn.example.com/a.png', url: 'nomi-local://a.png' }),
    )
    expect(clip?.url).toBe('nomi-local://a.png')
  })

  it('无 providerUrl 时退回 url', () => {
    const clip = buildClipFromGenerationNode(makeNode({ url: 'nomi-local://a.png' }))
    expect(clip?.url).toBe('nomi-local://a.png')
  })

  it('三者皆空 → null（无可用产物不允许成 clip）', () => {
    expect(buildClipFromGenerationNode(makeNode({}))).toBeNull()
    expect(buildClipFromGenerationNode(makeNode(null))).toBeNull()
  })
})

describe('buildClipFromGenerationNode 视频时长真相序（修「拖入视频一律 5 秒」）', () => {
  function videoNode(over: { result?: Partial<GenerationNodeResult>; meta?: Record<string, unknown> }): GenerationCanvasNode {
    return {
      id: 'node-v',
      kind: 'video',
      title: '一个视频',
      position: { x: 0, y: 0 },
      status: 'idle',
      result: { id: 'rv', type: 'video', url: 'nomi-local://v.mp4', createdAt: 1, ...over.result },
      ...(over.meta ? { meta: over.meta } : {}),
    }
  }

  it('无 result.durationSeconds 但有 meta.videoDuration → 用真实时长（不再钉死 5 秒）', () => {
    const clip = buildClipFromGenerationNode(videoNode({ meta: { videoDuration: 12 } }), { fps: 30 })
    expect(clip?.frameCount).toBe(360) // 12s * 30fps
  })

  it('result.durationSeconds 优先于 meta.videoDuration', () => {
    const clip = buildClipFromGenerationNode(videoNode({ result: { durationSeconds: 8 }, meta: { videoDuration: 12 } }), { fps: 30 })
    expect(clip?.frameCount).toBe(240) // 8s * 30fps
  })

  it('两者皆无 → 回退默认 5 秒', () => {
    const clip = buildClipFromGenerationNode(videoNode({}), { fps: 30 })
    expect(clip?.frameCount).toBe(150) // 5s * 30fps
  })
})

describe('buildClipFromGenerationNode 图片停留时长（分镜 v5：meta.imageDurationSec 生效）', () => {
  it('分镜图片镜带 meta.imageDurationSec → 落轨按停留时长（不再钉死 3 秒）', () => {
    const node = { ...makeNode({ url: 'nomi-local://a.png' }), meta: { imageDurationSec: 7 } }
    const clip = buildClipFromGenerationNode(node, { fps: 30 })
    expect(clip?.frameCount).toBe(210) // 7s * 30fps
  })

  it('无标记（画布手建图片节点）回落 DEFAULT_IMAGE_SECONDS=3 单源默认', () => {
    const clip = buildClipFromGenerationNode(makeNode({ url: 'nomi-local://a.png' }), { fps: 30 })
    expect(clip?.frameCount).toBe(90) // 3s * 30fps
  })

  it('非法标记（0/负数/非数字）视同无标记', () => {
    const node = { ...makeNode({ url: 'nomi-local://a.png' }), meta: { imageDurationSec: 0 } }
    expect(buildClipFromGenerationNode(node, { fps: 30 })?.frameCount).toBe(90)
  })
})

function videoClip(over: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip-1',
    type: 'video',
    sourceNodeId: 'node-1',
    label: '镜头',
    startFrame: 10,
    endFrame: 160,
    frameCount: 150,
    offsetStartFrame: 0,
    offsetEndFrame: 0,
    ...over,
  }
}
function result(over: Partial<GenerationNodeResult>): GenerationNodeResult {
  return { id: 'r2', type: 'video', createdAt: 2, ...over }
}

describe('explicit replacement preserves placement and trims', () => {
  it('replaces only the image source', () => {
    const clip = videoClip({ type: 'image', frameCount: 90, endFrame: 100, startFrame: 10 })
    expect(applyRegeneratedResultToClip(clip, result({ type: 'image', providerUrl: 'https://cdn/x.png' }), 30)).toMatchObject({ ...clip, url: 'https://cdn/x.png' })
  })
  it('rejects a short source', () => {
    expect(() => applyRegeneratedResultToClip(videoClip(), result({ providerUrl: 'https://cdn/v.mp4', durationSeconds: 3 }), 30)).toThrow('timeline_candidate_too_short')
  })
  it('keeps visible duration when a new source is longer', () => {
    expect(applyRegeneratedResultToClip(videoClip(), result({ providerUrl: 'https://cdn/v.mp4', durationSeconds: 8 }), 30)).toMatchObject({ frameCount: 240, startFrame: 10, endFrame: 160, offsetEndFrame: 90 })
  })
  it('rejects a source unable to cover the original in-point and duration', () => {
    const clip = videoClip({ offsetStartFrame: 30, offsetEndFrame: 30, endFrame: 100 })
    expect(() => applyRegeneratedResultToClip(clip, result({ providerUrl: 'https://cdn/v.mp4', durationSeconds: 2 }), 30)).toThrow('timeline_candidate_too_short')
  })
  it('keeps a clip with no usable result', () => {
    const clip = videoClip()
    expect(applyRegeneratedResultToClip(clip, result({}), 30)).toBe(clip)
  })
})
