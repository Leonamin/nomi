import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerationCanvasNode, NodeGroup } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
import { observeWebCanvas, projectWebCanvas, type WebCanvasKnowledge, type WebCanvasSource } from '../src/workbench/project/webCanvasProjection'
const { state, workbench, snapshot, creation, lifecycle } = vi.hoisted(() => ({
  state: { nodes: [] as GenerationCanvasNode[], groups: [] as NodeGroup[], edges: [], applyEventTail: vi.fn() },
  workbench: { workbenchDocuments: [], storyboardDesignsByDocumentId: {}, hydrateWorkbenchDocuments: vi.fn(), hydrateStoryboardDesigns: vi.fn() },
  snapshot: vi.fn(), creation: vi.fn(), lifecycle: { tick: null as (() => void) | null, cleanup: null as (() => void) | null },
}))
let known: WebCanvasKnowledge = { nodes: {}, groups: {} }
const api = {
  generationSnapshot: snapshot, creationSnapshot: creation,
  projectCreation: (local: object) => local, appliedCreationKnowledge: () => ({ documents: {}, designs: {} }), acknowledgeCreation: vi.fn(),
  projectGenerationCanvas: projectWebCanvas, appliedCanvasKnowledge: () => structuredClone(known),
  acknowledgeCanvas: vi.fn((_projectId: string, knowledge: WebCanvasKnowledge) => { known = structuredClone(knowledge) }),
  acknowledgeAgentNodes: vi.fn().mockResolvedValue(undefined),
}
vi.mock('react', () => ({ useEffect: (effect: () => (() => void)) => { lifecycle.cleanup = effect() } }))
vi.mock('../src/desktop/bridge', () => ({ getDesktopBridge: () => ({ web: api }) }))
vi.mock('../src/workbench/generationCanvas/store/generationCanvasStore', () => ({ useGenerationCanvasStore: { getState: () => state } }))
vi.mock('../src/workbench/workbenchStore', () => ({ useWorkbenchStore: { getState: () => workbench } }))
import { useWebGenerationSync } from '../src/workbench/generationCanvas/runner/useWebGenerationSync'
const result = { id: 'candidate-A', type: 'video' as const, createdAt: 1, url: 'old.mp4' }
const original: GenerationCanvasNode = { id: 'shot', kind: 'video', title: 'Shot', position: { x: 0, y: 0 }, prompt: 'First', status: 'success', result, history: [result], runs: [{ id: 'run-A', startedAt: 1, updatedAt: 1, status: 'success' }], meta: { isWebAgentCreated: true } }
function remote(canvas: WebCanvasSource) { return { jobs: [{ key: 'same-key', node: canvas.nodes[0], isPending: false }], canvas, knowledge: observeWebCanvas(canvas) } }
beforeEach(() => {
  lifecycle.cleanup?.()
  vi.clearAllMocks()
  vi.stubGlobal('window', { setInterval: (tick: () => void) => { lifecycle.tick = tick; return 1 }, clearInterval: () => undefined })
  state.nodes = [structuredClone(original)]; state.groups = []; state.edges = []
  known = observeWebCanvas(state)
  state.applyEventTail.mockImplementation(events => { Object.assign(state, events[0].payload.snapshot) })
  creation.mockResolvedValue({ payload: { workbenchDocuments: [], storyboardDesignsByDocumentId: {} }, knowledge: { documents: {}, designs: {} } })
  snapshot.mockResolvedValue(remote({ nodes: [original], groups: [], edges: [] }))
})
describe('web complete canvas snapshot projection', () => {
  it('shows a missed failed run even when its previous successful candidate is known', async () => {
    const failed = { ...original, status: 'error' as const, error: 'GPU failed', runs: [{ id: 'run-B', startedAt: 2, updatedAt: 2, status: 'error' as const }] }
    snapshot.mockResolvedValue(remote({ nodes: [failed], groups: [], edges: [] }))
    useWebGenerationSync('project')
    await vi.waitFor(() => expect(state.nodes[0]).toMatchObject({ status: 'error', error: 'GPU failed', runs: failed.runs }))
  })
  it('keeps deliberate candidate selection after the same successful run was applied', async () => {
    state.nodes = [{ ...original, result: { ...result, id: 'chosen-old' }, history: [result] }]
    useWebGenerationSync('project')
    await vi.waitFor(() => expect(api.acknowledgeCanvas).toHaveBeenCalled())
    expect(state.nodes[0].result?.id).toBe('chosen-old')
  })
  it('projects a new candidate and prompt under the same terminal job key', async () => {
    useWebGenerationSync('project')
    await vi.waitFor(() => expect(api.acknowledgeCanvas).toHaveBeenCalledTimes(1))
    const fresh = { ...result, id: 'candidate-B', createdAt: 3, url: 'new.mp4' }
    snapshot.mockResolvedValue(remote({ nodes: [{ ...original, result: fresh, history: [fresh, result], prompt: 'Updated candidate' }], groups: [], edges: [] }))
    lifecycle.tick!()
    await vi.waitFor(() => expect(state.nodes[0]).toMatchObject({ result: fresh, prompt: 'Updated candidate' }))
  })
  it('restores a complete unseen group and table but does not recreate a human-deleted member', async () => {
    state.nodes = []
    const table = { ...original, id: 'table', kind: 'shot_table' as const, groupId: 'group' }
    const group: NodeGroup = { id: 'group', name: 'Production', categoryId: 'shots', nodeIds: ['shot', 'table'], materializationOperationId: 'canvas-landing:run', createdAt: 1, updatedAt: 1 }
    snapshot.mockResolvedValue(remote({ nodes: [{ ...original, groupId: 'group' }, table], groups: [group], edges: [] }))
    useWebGenerationSync('project')
    await vi.waitFor(() => expect(state.groups).toHaveLength(1))
    expect(state.nodes.map(node => node.id)).toEqual(['table'])
    expect(state.groups[0].nodeIds).toEqual(['table'])
  })
  it('does not acknowledge or project an outstanding response after the view closes', async () => {
    let finish!: (value: ReturnType<typeof remote>) => void
    snapshot.mockReturnValue(new Promise(resolve => { finish = resolve }))
    useWebGenerationSync('project')
    lifecycle.cleanup!()
    finish(remote({ nodes: [{ ...original, prompt: 'Wrong view' }], groups: [], edges: [] }))
    await Promise.resolve(); await Promise.resolve()
    expect(state.applyEventTail).not.toHaveBeenCalled()
    expect(api.acknowledgeCanvas).not.toHaveBeenCalled()
  })
})
