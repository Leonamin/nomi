import { readProject, saveProject, type ProjectRecord } from '../electron/projects/repository'
import { nodeRunOutcomePatch, type NodeRunOutcome } from '../src/workbench/generationCanvas/store/nodeRunOutcome'
import type { GenerationCanvasNode } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
import { createDefaultWorkbenchProjectPayload, type WorkbenchProjectPayload } from '../src/workbench/project/projectRecordSchema'

const writes = new Map<string, Promise<unknown>>()
/** Serialize Nomi project edits and background outcome delivery at the same boundary. */
export function mutateWebProject<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const previous = writes.get(projectId) ?? Promise.resolve()
  const result = previous.catch(() => undefined).then(operation)
  const settled = result.then(() => undefined, () => undefined)
  writes.set(projectId, settled)
  void settled.finally(() => { if (writes.get(projectId) === settled) writes.delete(projectId) })
  return result
}
export function projectCanvas(record: ProjectRecord): WorkbenchProjectPayload {
  if (!record.payload || typeof record.payload !== 'object') throw new Error('Project canvas is missing')
  const payload = record.payload as Partial<WorkbenchProjectPayload>
  if (payload.generationCanvas) return payload as WorkbenchProjectPayload
  // 新規作成直後の payload には canvas がまだ無い（renderer は読込時に正規化する）。サーバ側の読書き
  // （agent ツール / outcome 反映 / 保存マージ）が `undefined.nodes` で落ちるので、ここで既定を敷く
  // （2026-10-13 実機: Nomi エージェントの nomi_project_read が新規プロジェクトで例外）。
  return { ...createDefaultWorkbenchProjectPayload(), ...payload } as WorkbenchProjectPayload
}
export async function deliverWebOutcome(projectId: string, nodeId: string, outcome: NodeRunOutcome) {
  return mutateWebProject(projectId, async () => {
    const record = readProject(projectId)
    if (!record) return
    const payload = projectCanvas(record)
    const nodes = payload.generationCanvas.nodes.map(node => node.id === nodeId ? { ...node, ...nodeRunOutcomePatch(node, outcome) } : node)
    await saveProject(projectId, { ...record, payload: { ...payload, generationCanvas: { ...payload.generationCanvas, nodes } } })
  })
}

/** Incoming edits cannot erase results which the server delivered after that browser read. */
export function mergeServerResults(current: GenerationCanvasNode, incoming: GenerationCanvasNode): GenerationCanvasNode {
  const currentResults = [current.result, ...(current.history ?? [])].filter(result => result !== undefined)
  const incomingResults = [incoming.result, ...(incoming.history ?? [])].filter(result => result !== undefined)
  const history = [...new Map([...currentResults, ...incomingResults].map(result => [result.id, result])).values()]
  const hasSeenCurrentResult = !current.result || incomingResults.some(result => result.id === current.result!.id)
  const currentRun = current.runs?.[0]
  const incomingRun = incoming.runs?.[0]
  const isServerPending = current.meta?.isWebGenerationOwned === true && (current.status === 'running' || current.status === 'queued')
  const isSameOrOlderRun = !incomingRun || Boolean(currentRun && (incomingRun.id === currentRun.id || incomingRun.startedAt <= currentRun.startedAt))
  const hasStaleTerminalStatus = (current.status === 'error' || current.status === 'idle' || current.status === 'success') && (incoming.status === 'running' || incoming.status === 'queued' || incoming.status === 'recoverable') && isSameOrOlderRun
  const hasNewCompletedResult = current.status === 'success' && !hasSeenCurrentResult
  return {
    ...incoming,
    history,
    meta: { ...incoming.meta, ...(current.meta?.isWebGenerationOwned ? { isWebGenerationOwned: true, webJobKey: current.meta.webJobKey } : {}) },
    ...(hasNewCompletedResult || hasStaleTerminalStatus || isServerPending ? { result: current.result, status: current.status, error: current.error, progress: current.progress, runs: current.runs } : {}),
  }
}
export function preserveUnseenAgentNodes(current: GenerationCanvasNode[], incoming: GenerationCanvasNode[], knownIds: ReadonlySet<string>): GenerationCanvasNode[] {
  const incomingIds = new Set(incoming.map(node => node.id))
  return [...incoming, ...current.filter(node => node.meta?.isWebAgentCreated === true && !incomingIds.has(node.id) && !knownIds.has(node.id))]
}
export async function saveWebProject(projectId: string, incoming: ProjectRecord, knownAgentIds: ReadonlySet<string> = new Set()) {
  const admittedAgentIds = new Set(knownAgentIds)
  return mutateWebProject(projectId, async () => {
    const current = readProject(projectId)
    if (!current) throw new Error('Project not found')
    const payload = projectCanvas(incoming)
    const currentNodes = new Map(projectCanvas(current).generationCanvas.nodes.map(node => [node.id, node]))
    const merged = payload.generationCanvas.nodes.map(node => currentNodes.has(node.id) ? mergeServerResults(currentNodes.get(node.id)!, node) : node)
    const nodes = preserveUnseenAgentNodes([...currentNodes.values()], merged, admittedAgentIds)
    return saveProject(projectId, { ...incoming, payload: { ...payload, generationCanvas: { ...payload.generationCanvas, nodes } } })
  })
}


export async function markWebGenerationOwned(projectId: string, nodeId: string, jobKey: string) {
  return mutateWebProject(projectId, async () => {
    const record = readProject(projectId)
    if (!record) throw new Error('Project not found')
    const payload = projectCanvas(record)
    const nodes = payload.generationCanvas.nodes.map(node => node.id === nodeId ? { ...node, meta: { ...node.meta, isWebGenerationOwned: true, webJobKey: jobKey }, ...nodeRunOutcomePatch(node, { kind: 'status', status: 'running' }) } : node)
    await saveProject(projectId, { ...record, payload: { ...payload, generationCanvas: { ...payload.generationCanvas, nodes } } })
  })
}
