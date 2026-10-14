import { describe, expect, it } from 'vitest'
import { mergeWebCanvas, observeWebCanvas, projectWebCanvas } from './webCanvasProjection'
import type { GenerationCanvasNode, NodeGroup } from '../generationCanvas/model/generationCanvasTypes'
const old = { id: 'old', type: 'video' as const, url: 'old.mp4', createdAt: 1 }
const fresh = { ...old, id: 'fresh', url: 'fresh.mp4', createdAt: 3 }
const shot: GenerationCanvasNode = { id: 'shot', kind: 'video', title: 'Shot', position: { x: 1, y: 2 }, prompt: 'Initial', result: old, history: [old], status: 'success', runs: [{ id: 'run-1', startedAt: 1, updatedAt: 1, status: 'success' }], meta: { isWebAgentCreated: true, modelKey: 'model-old' } }
const group: NodeGroup = { id: 'group', name: 'Group', categoryId: 'shots', nodeIds: ['shot'], materializationOperationId: 'canvas-landing:run', createdAt: 1, updatedAt: 1 }
const initial = { nodes: [shot], groups: [group], edges: [] }
const server = { ...initial, nodes: [{ ...shot, prompt: 'New candidate', result: fresh, history: [fresh, old], meta: { ...shot.meta, modelKey: 'model-new' } }] }
describe('canvas exact observation merge', () => {
  it('projects a candidate revision with the same node/run key and its model/prompt', () => {
    expect(projectWebCanvas(initial, server, observeWebCanvas(initial)).nodes[0]).toMatchObject({ result: fresh, prompt: 'New candidate', meta: { modelKey: 'model-new' } })
  })
  it('preserves independent human prompt/position/model/selection while retaining unseen output', () => {
    const baseline = { ...initial, nodes: [{ ...shot, result: fresh, history: [fresh, old] }] }
    const local = { ...baseline, nodes: [{ ...baseline.nodes[0], prompt: 'Human prompt', position: { x: 9, y: 8 }, result: old, meta: { ...shot.meta, modelKey: 'human-model' } }] }
    const projected = projectWebCanvas(local, server, observeWebCanvas(baseline))
    expect(projected.nodes[0]).toMatchObject({ prompt: 'Human prompt', position: { x: 9, y: 8 }, result: old, meta: { modelKey: 'human-model' } })
    expect(projected.nodes[0].history).toContainEqual(fresh)
  })
  it('does not recreate an observed deleted group/node but preserves unseen additions', () => {
    expect(projectWebCanvas({ nodes: [], groups: [], edges: [] }, initial, observeWebCanvas(initial))).toMatchObject({ nodes: [], groups: [] })
    expect(projectWebCanvas({ nodes: [], groups: [], edges: [] }, initial, { nodes: {}, groups: {} })).toMatchObject({ nodes: [shot], groups: [group] })
  })
  it('keeps new server group members while honoring a human removal of known members', () => {
    const additional = { ...shot, id: 'new-shot' }
    const local = { ...initial, groups: [{ ...group, name: 'Human group', nodeIds: [] }] }
    const remote = { ...initial, nodes: [shot, additional], groups: [{ ...group, nodeIds: ['shot', 'new-shot'] }] }
    expect(projectWebCanvas(local, remote, observeWebCanvas(initial)).groups[0]).toMatchObject({ name: 'Human group', nodeIds: ['new-shot'] })
  })
  it('retains unseen production edges, honors deletion, and never revives a removed managed edge', () => {
    const target = { ...shot, id: 'target' }
    const edge = { id: 'edge', source: 'shot', target: 'target' }
    const connected = { ...initial, nodes: [shot, target], edges: [edge] }
    const local = { ...connected, edges: [] }
    expect(projectWebCanvas(local, connected, observeWebCanvas(initial)).edges).toEqual([edge])
    expect(projectWebCanvas(local, connected, observeWebCanvas(connected)).edges).toEqual([])
    const deleted = { ...local, webManagedCanvas: { nodes: { shot: true as const, target: true as const }, groups: { group: true as const }, edges: { edge: true as const } } }
    expect(mergeWebCanvas(deleted, connected, observeWebCanvas(connected)).edges).toEqual([])
  })
  it('protects a newer browser-started manual run from an older polling result', () => {
    const running = { ...shot, status: 'running' as const, result: undefined, runs: [{ id: 'manual-run', startedAt: 9, updatedAt: 9, status: 'running' as const }] }
    const local = { ...initial, nodes: [running] }
    expect(projectWebCanvas(local, server, observeWebCanvas(initial)).nodes[0]).toMatchObject({ status: 'running', result: undefined, runs: running.runs })
  })
  it('does not advance an already captured save observation after polling acknowledges a revision', () => {
    const captured = observeWebCanvas(initial)
    const before = structuredClone(captured)
    observeWebCanvas(server)
    expect(captured).toEqual(before)
    expect(mergeWebCanvas(server, initial, captured).nodes[0].prompt).toBe('New candidate')
  })
})
