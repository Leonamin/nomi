import { z } from 'zod'
import type { GenerationCanvasNode, GenerationCanvasEdge, NodeGroup } from '../generationCanvas/model/generationCanvasTypes'
import { webCreationFieldHash } from './webCreationProjection'

const fieldPins = z.record(z.string().regex(/^[a-f0-9]{64}$/))
export const webCanvasKnowledgeSchema = z.object({
  nodes: z.record(fieldPins),
  edges: z.record(fieldPins).optional(),
  groups: z.record(z.object({ fields: fieldPins, nodeIds: z.array(z.string()).max(10000) }).strict()),
}).strict()
export type WebCanvasKnowledge = z.infer<typeof webCanvasKnowledgeSchema>
export const webManagedCanvasSchema = z.object({ nodes: z.record(z.literal(true)), groups: z.record(z.literal(true)), edges: z.record(z.literal(true)).optional() }).strict()
export type WebManagedCanvas = z.infer<typeof webManagedCanvasSchema>
export type WebCanvasProjection = { nodes: GenerationCanvasNode[]; groups: NodeGroup[]; edges: GenerationCanvasEdge[] }
export type WebCanvasSource = WebCanvasProjection & { webManagedCanvas?: WebManagedCanvas }
export type WebGenerationSnapshot = {
  jobs: Array<{ key: string; isPending: boolean; node?: GenerationCanvasNode }>
  canvas: WebCanvasSource
  knowledge: WebCanvasKnowledge
}
const outcomeKeys = new Set(['result', 'history', 'runs', 'status', 'error', 'progress'])
const ownershipMetaKeys = ['isWebAgentCreated', 'isWebGenerationOwned', 'webJobKey', 'materializationOperationId', 'materializationClientId', 'productionRunId', 'productionShotId']
function pins(value: object): Record<string, string> {
  const fields = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'meta').map(([key, field]) => [key, webCreationFieldHash(field)]))
  if ('meta' in value && value.meta && typeof value.meta === 'object') {
    for (const [key, field] of Object.entries(value.meta)) fields[`meta:${key}`] = webCreationFieldHash(field)
  }
  return fields
}
export function observeWebCanvas(canvas: WebCanvasProjection): WebCanvasKnowledge {
  return {
    edges: Object.fromEntries(canvas.edges.map(edge => [edge.id, pins(edge)])),
    nodes: Object.fromEntries(canvas.nodes.map(node => [node.id, pins(node)])),
    groups: Object.fromEntries(canvas.groups.map(group => [group.id, { fields: pins(group), nodeIds: [...group.nodeIds] }])),
  }
}
function hasEdit(value: unknown, known: Record<string, string> | undefined, key: string): boolean {
  return Boolean(known && webCreationFieldHash(value) !== (known[key] || webCreationFieldHash(undefined)))
}
function mergeFields<T extends object>(saved: T, incoming: T, known: Record<string, string> | undefined, excluded: ReadonlySet<string> = new Set()): T {
  const local = incoming as Record<string, unknown>
  const remote = saved as Record<string, unknown>
  const merged: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    if (excluded.has(key)) continue
    const value = hasEdit(local[key], known, key) ? local[key] : remote[key]
    if (value !== undefined) merged[key] = value
  }
  return merged as T
}
function isManagedNode(node: GenerationCanvasNode): boolean { return node.meta?.isWebAgentCreated === true }
function managedIds(source: WebCanvasSource): WebManagedCanvas {
  const nodeIds = new Set(source.nodes.filter(isManagedNode).map(node => node.id))
  return {
    edges: { ...source.webManagedCanvas?.edges, ...Object.fromEntries(source.edges.filter(edge => nodeIds.has(edge.source) || nodeIds.has(edge.target)).map(edge => [edge.id, true as const])) },
    nodes: { ...source.webManagedCanvas?.nodes, ...Object.fromEntries(source.nodes.filter(isManagedNode).map(node => [node.id, true as const])) },
    groups: { ...source.webManagedCanvas?.groups, ...Object.fromEntries(source.groups.filter(group => Boolean(group.materializationOperationId)).map(group => [group.id, true as const])) },
  }
}
export function mergeWebNodeOutcome(current: GenerationCanvasNode, incoming: GenerationCanvasNode, hasResultEdit = false, shouldProtectNewerRun = false): GenerationCanvasNode {
  const currentResults = [current.result, ...(current.history ?? [])].filter(result => result !== undefined)
  const incomingResults = [incoming.result, ...(incoming.history ?? [])].filter(result => result !== undefined)
  const history = [...new Map([...currentResults, ...incomingResults].map(result => [result.id, result])).values()]
  const hasSeenCurrentResult = !current.result || incomingResults.some(result => result.id === current.result!.id)
  const currentRun = current.runs?.[0]
  const incomingRun = incoming.runs?.[0]
  const hasNewerIncomingRun = Boolean(incomingRun && currentRun && incomingRun.startedAt > currentRun.startedAt)
  if (shouldProtectNewerRun && hasNewerIncomingRun) return { ...incoming, history }
  const isServerPending = current.meta?.isWebGenerationOwned === true && (current.status === 'running' || current.status === 'queued')
  const isSameOrOlderRun = !incomingRun || Boolean(currentRun && (incomingRun.id === currentRun.id || incomingRun.startedAt <= currentRun.startedAt))
  const hasStaleTerminalStatus = (current.status === 'error' || current.status === 'idle' || current.status === 'success') && (incoming.status === 'running' || incoming.status === 'queued' || incoming.status === 'recoverable') && isSameOrOlderRun
  const hasNewServerRun = Boolean(currentRun && (!incomingRun || currentRun.startedAt > incomingRun.startedAt))
  const hasNewCompletedResult = current.status === 'success' && !hasSeenCurrentResult
  return {
    ...incoming,
    history,
    meta: { ...incoming.meta, ...(current.meta?.isWebGenerationOwned ? { isWebGenerationOwned: true, webJobKey: current.meta.webJobKey } : {}) },
    ...(hasNewCompletedResult || hasStaleTerminalStatus || isServerPending || hasNewServerRun ? { result: hasResultEdit ? incoming.result : current.result, status: current.status, error: current.error, progress: current.progress, runs: current.runs } : {}),
  }
}
/** One domain merge for repository saves and live browser projection. */
export function mergeWebCanvas(server: WebCanvasSource, local: WebCanvasProjection, observed: WebCanvasKnowledge = { nodes: {}, groups: {} }, shouldProtectNewerRun = false): WebCanvasSource {
  const managed = managedIds(server)
  const currentNodes = new Map(server.nodes.map(node => [node.id, node]))
  const localNodes = new Map(local.nodes.map(node => [node.id, node]))
  const nodes = local.nodes.flatMap(node => {
    const current = currentNodes.get(node.id)
    if (!current) return managed.nodes[node.id] && observed.nodes[node.id] ? [] : [node]
    const known = observed.nodes[node.id]
    const hasResultEdit = hasEdit(node.result, known, 'result')
    const outcome = mergeWebNodeOutcome(current, node, hasResultEdit, shouldProtectNewerRun)
    if (!managed.nodes[node.id]) return [outcome]
    const authored = mergeFields(current, node, known, new Set([...outcomeKeys, 'meta']))
    const meta = mergeFields(current.meta || {}, node.meta || {}, known && Object.fromEntries(Object.entries(known).filter(([key]) => key.startsWith('meta:')).map(([key, hash]) => [key.slice(5), hash])))
    for (const key of ownershipMetaKeys) if (current.meta?.[key] !== undefined) meta[key] = current.meta[key]
    return [{ ...outcome, ...authored, meta }]
  })
  nodes.push(...server.nodes.filter(node => managed.nodes[node.id] && !localNodes.has(node.id) && !observed.nodes[node.id]))
  const nodeIds = new Set(nodes.map(node => node.id))
  const currentGroups = new Map(server.groups.map(group => [group.id, group]))
  const localGroups = new Map(local.groups.map(group => [group.id, group]))
  const groups = local.groups.flatMap(group => {
    const current = currentGroups.get(group.id)
    if (!current) return managed.groups[group.id] && observed.groups[group.id] ? [] : [group]
    if (!managed.groups[group.id]) return [group]
    const known = observed.groups[group.id]
    const merged = mergeFields(current, group, known?.fields)
    if (known && hasEdit(group.nodeIds, known.fields, 'nodeIds')) {
      merged.nodeIds = [...new Set([...group.nodeIds, ...current.nodeIds.filter(id => !known.nodeIds.includes(id))])]
    }
    return [merged]
  })
  groups.push(...server.groups.filter(group => managed.groups[group.id] && !localGroups.has(group.id) && !observed.groups[group.id]))
  const groupIds = new Set(groups.map(group => group.id))
  const currentEdges = new Map(server.edges.map(edge => [edge.id, edge]))
  const localEdgeIds = new Set(local.edges.map(edge => edge.id))
  const edges = local.edges.flatMap(edge => {
    const current = currentEdges.get(edge.id)
    if (!current) return managed.edges?.[edge.id] && observed.edges?.[edge.id] ? [] : [edge]
    return [managed.edges?.[edge.id] ? mergeFields(current, edge, observed.edges?.[edge.id]) : edge]
  })
  edges.push(...server.edges.filter(edge => managed.edges?.[edge.id] && !localEdgeIds.has(edge.id) && !observed.edges?.[edge.id]))
  return {
    nodes: nodes.map(node => node.groupId && !groupIds.has(node.groupId) ? { ...node, groupId: undefined } : node),
    groups: groups.map(group => ({ ...group, nodeIds: group.nodeIds.filter(id => nodeIds.has(id)) })),
    edges: edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    webManagedCanvas: managed,
  }
}
export function projectWebCanvas(local: WebCanvasProjection, server: WebCanvasSource, observed: WebCanvasKnowledge): WebCanvasSource {
  return mergeWebCanvas(server, local, observed, true)
}
