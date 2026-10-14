import { readProject, saveProject, type ProjectRecord } from '../electron/projects/repository'
import { nodeRunOutcomePatch, type NodeRunOutcome } from '../src/workbench/generationCanvas/store/nodeRunOutcome'
import { mergeWebCreation, webCreationKnowledgeSchema } from '../src/workbench/project/webCreationProjection'
import { mergeWebCanvas, webCanvasKnowledgeSchema } from '../src/workbench/project/webCanvasProjection'
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

export { mergeWebNodeOutcome as mergeServerResults } from '../src/workbench/project/webCanvasProjection'
export async function saveWebProject(projectId: string, incoming: ProjectRecord, knownAgentIds: ReadonlySet<string> = new Set()) {
  const admittedAgentIds = new Set(knownAgentIds)
  const canvasObserved = webCanvasKnowledgeSchema.parse(projectCanvas(incoming).webAgentSeenCanvas || { nodes: Object.fromEntries([...admittedAgentIds].map(id => [id, {}])), groups: {} })
  const observed = webCreationKnowledgeSchema.parse(projectCanvas(incoming).webAgentSeenCreation || { documents: {}, designs: {} })
  return mutateWebProject(projectId, async () => {
    const current = readProject(projectId)
    if (!current) throw new Error('Project not found')
    const payload = projectCanvas(incoming)
    const currentPayload = projectCanvas(current)
    const canvas = mergeWebCanvas({ ...currentPayload.generationCanvas, webManagedCanvas: currentPayload.webManagedCanvas }, payload.generationCanvas, canvasObserved)
    return saveProject(projectId, { ...incoming, payload: { ...payload, ...mergeWebCreation(currentPayload, payload, observed), webManagedCanvas: canvas.webManagedCanvas, generationCanvas: { ...payload.generationCanvas, nodes: canvas.nodes, groups: canvas.groups, edges: canvas.edges } } })
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
