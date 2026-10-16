import type { TimelineClip, TimelineClipType } from '../../timeline/timelineTypes'
import type { GenerationCanvasNode, GenerationNodeResult } from './generationCanvasTypes'
import { getGenerationNodeExecutionKind } from './generationNodeKinds'

/**
 * 图片素材的默认停留秒数——时间轴 clip 与分镜表「图片镜停留时长」的**单一真相源**
 * （分镜 v5：`PlanShot.durationSec` 对图片镜生效为停留时长，默认值必须与 clip 落轨一致，
 * 禁止在别处再写字面量 3）。
 */
export const DEFAULT_IMAGE_SECONDS = 3
const DEFAULT_VIDEO_SECONDS = 5

type BuildClipOptions = {
  fps?: number
  startFrame?: number
  resultId?: string
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * clip 播放 URL 口径：本地 url > providerUrl > thumbnailUrl（PR#54：本地持久文件优先，
 * 不再优先会过期的 ComfyUI/CDN providerUrl；providerUrl 仅在无本地拷贝时兜底）。
 * 与 referenceUrl.resultUrl 同序但**不过 asUrl 的 vendor 白名单**——clip.url 供本地 <video>/<img>
 * 播放，file:// / nomi-local:// 等本地 scheme 都合法；被 vendor 白名单收紧会把 file:// 产物误丢成 null clip（记忆 url-priority-inconsistency）。
 */
function pickClipUrl(result: GenerationNodeResult | null | undefined): string {
  return readString(result?.url) || readString(result?.providerUrl) || readString(result?.thumbnailUrl)
}

function readPositiveNumber(value: unknown): number | null {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) && next > 0 ? next : null
}

function normalizeFrame(value: unknown): number {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0
}

function resolveSelectedResult(node: GenerationCanvasNode, resultId?: string): GenerationNodeResult | null {
  const selectedResultId = readString(resultId)
  if (!selectedResultId) return node.result || null
  return (node.history || []).find((result) => result.id === selectedResultId) || null
}

function resolveClipType(node: GenerationCanvasNode, result: GenerationNodeResult | null): TimelineClipType {
  // v0.7.1: audio category 优先级最高（即使 kind 占位是 image）
  if (node.categoryId === 'audio') return 'audio'
  if (result?.type === 'image' || result?.type === 'video' || result?.type === 'audio') return result.type
  const executionKind = getGenerationNodeExecutionKind(node.kind)
  if (executionKind === 'image') return 'image'
  if (executionKind === 'video') return 'video'
  if (executionKind === 'audio') return 'audio'
  return 'image'
}

function durationMetaForSelectedResult(
  node: GenerationCanvasNode,
  result: GenerationNodeResult | null,
  resultId: string | undefined,
  type: TimelineClipType,
): Record<string, unknown> | undefined {
  // node.meta belongs to the current result; an explicitly selected older audio
  // result must use its own duration or be measured from its own file.
  if (type === 'audio' && readString(resultId) && result?.id !== node.result?.id) return undefined
  return node.meta as Record<string, unknown> | undefined
}

function resolveKnownMediaDurationSeconds(
  type: TimelineClipType,
  result: GenerationNodeResult | null,
  meta: Record<string, unknown> | undefined,
): number | null {
  return readPositiveNumber(result?.durationSeconds)
    ?? readPositiveNumber(type === 'audio' ? meta?.durationSec : meta?.videoDuration)
}

/** The async timeline admission only probes audio files without a recorded positive duration. */
export function readKnownGenerationAudioDurationSeconds(node: GenerationCanvasNode, resultId?: string): number | null {
  const result = resolveSelectedResult(node, resultId)
  return resolveKnownMediaDurationSeconds(
    'audio',
    result,
    durationMetaForSelectedResult(node, result, resultId, 'audio'),
  )
}

function resolveFrameCount(
  type: TimelineClipType,
  fps: number,
  knownDurationSeconds: number | null,
  imageDurationSeconds?: number | null,
): number {
  // 图片停留时长（分镜 v5）：镜行「时长」写进 node.meta.imageDurationSec，落轨/顺播同口径；
  // 无标记（画布手建图片节点等）回落 DEFAULT_IMAGE_SECONDS 单源默认。
  if (type === 'image') return Math.max(1, Math.round((imageDurationSeconds ?? DEFAULT_IMAGE_SECONDS) * fps))
  // 音频：result.durationSeconds > meta.durationSec；视频：result.durationSeconds > meta.videoDuration。
  // 未知时长保持既有非图片默认 5 秒；异步入轨会先尝试探测音频文件的真实时长。
  return Math.max(1, Math.round((knownDurationSeconds ?? DEFAULT_VIDEO_SECONDS) * fps))
}

function buildClipId(nodeId: string, type: TimelineClipType, startFrame: number, result: GenerationNodeResult | null): string {
  const resultPart = result?.id ? `-${result.id}` : ''
  return `clip-${nodeId}${resultPart}-${type}-${startFrame}`
}

function isBlockedByActiveStatus(node: GenerationCanvasNode, resultId?: string): boolean {
  if (node.status !== 'queued' && node.status !== 'running' && node.status !== 'error') return false
  return !readString(resultId)
}

export function buildClipFromGenerationNode(node: GenerationCanvasNode, options?: BuildClipOptions): TimelineClip | null {
  if (!node?.id) return null
  if (isBlockedByActiveStatus(node, options?.resultId)) return null

  const result = resolveSelectedResult(node, options?.resultId)
  if (options?.resultId && !result) return null

  const fps = readPositiveNumber(options?.fps) || 30
  const startFrame = normalizeFrame(options?.startFrame)
  const type = resolveClipType(node, result)
  const label = readString(node.title) || readString(node.prompt) || node.id
  const url = pickClipUrl(result)
  const thumbnailUrl = readString(result?.thumbnailUrl) || (type === 'image' ? url : '')

  // v0.7.1: image / video / audio 都要求有 url（生成或上传后才允许拖）
  if (!url) return null

  const meta = node.meta as Record<string, unknown> | undefined
  const durationMeta = durationMetaForSelectedResult(node, result, options?.resultId, type)
  const knownDurationSeconds = resolveKnownMediaDurationSeconds(type, result, durationMeta)
  const imageDurationSeconds = readPositiveNumber(meta?.imageDurationSec)
  const frameCount = resolveFrameCount(type, fps, knownDurationSeconds, imageDurationSeconds)

  return {
    id: buildClipId(node.id, type, startFrame, result),
    type,
    sourceNodeId: node.id,
    label,
    startFrame,
    endFrame: startFrame + frameCount,
    frameCount,
    offsetStartFrame: 0,
    offsetEndFrame: 0,
    ...(url ? { url } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
  }
}

/** Explicit source replacement preserves the authored in-point and visible duration.
 * Images retain authored duration; insufficient video/audio sources reject before publication.
 */
export function applyRegeneratedResultToClip(
  clip: TimelineClip,
  result: GenerationNodeResult | null,
  fps?: number,
): TimelineClip {
  const url = pickClipUrl(result)
  if (!url) return clip
  const thumbnailUrl = readString(result?.thumbnailUrl) || (clip.type === 'image' ? url : clip.thumbnailUrl || '')

  if (clip.type === 'image') {
    return { ...clip, url, ...(thumbnailUrl ? { thumbnailUrl } : {}) }
  }

  const safeFps = readPositiveNumber(fps) || 30
  const nextFrameCount = resolveFrameCount(clip.type, safeFps, resolveKnownMediaDurationSeconds(clip.type, result, undefined))
  const offsetStartFrame = clip.offsetStartFrame
  const visible = clip.endFrame - clip.startFrame
  if (nextFrameCount < offsetStartFrame + visible) throw new Error('timeline_candidate_too_short')
  const offsetEndFrame = nextFrameCount - offsetStartFrame - visible
  return {
    ...clip,
    url,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    frameCount: nextFrameCount,
    offsetStartFrame,
    offsetEndFrame,
    endFrame: clip.endFrame,
  }
}
