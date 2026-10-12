import type { GenerationCanvasSnapshot, NodeGroup } from './generationCanvasTypes'
import type { CanvasGraphActions } from '../store/canvasStoreTypes'
import { createGroupId } from '../store/canvasIds'
import { isCategoryId } from '../store/canvasGuards'
import { frameBoundsFromMembers } from './canvasFrameBounds'
import { resolveNodeVisualSize } from '../nodes/nodeSizing'

/** Group membership and geometry owner shared by the renderer action and headless production landing. */
export function createCanvasGroupSnapshot(
  snapshot: GenerationCanvasSnapshot,
  categoryId: Parameters<CanvasGraphActions['createGroup']>[0],
  name: Parameters<CanvasGraphActions['createGroup']>[1],
  options?: Parameters<CanvasGraphActions['createGroup']>[2],
): { snapshot: GenerationCanvasSnapshot; group: NodeGroup | null } {
  const id = String(categoryId || '').trim()
  if (!isCategoryId(id)) return { snapshot, group: null }
  const now = Date.now()
  const existingCount = (snapshot.groups ?? []).filter(group => group.categoryId === id).length
  const explicitNodeIds = Array.isArray(options?.nodeIds)
    ? snapshot.nodes.filter(node => options.nodeIds!.includes(node.id) && (node.categoryId || 'shots') === id).map(node => node.id)
    : []
  const stamp = options?.materializationOperationId?.trim()
  const frameBounds = options?.frameBounds ?? frameBoundsFromMembers(
    snapshot.nodes.filter(node => explicitNodeIds.includes(node.id)).map(node => ({ x: node.position.x, y: node.position.y, ...resolveNodeVisualSize(node) })),
  )
  const group: NodeGroup = {
    id: createGroupId(id), name: (name || '').trim() || `组 ${existingCount + 1}`, categoryId: id, nodeIds: explicitNodeIds,
    ...(frameBounds ? { frameBounds } : {}), ...(stamp ? { materializationOperationId: stamp } : {}), createdAt: now, updatedAt: now,
  }
  return {
    group,
    snapshot: {
      ...snapshot,
      nodes: snapshot.nodes.map(node => explicitNodeIds.includes(node.id) ? { ...node, groupId: group.id } : node),
      groups: [...(snapshot.groups ?? []).map(existing => ({ ...existing, nodeIds: existing.nodeIds.filter(nodeId => !explicitNodeIds.includes(nodeId)) })), group],
    },
  }
}
