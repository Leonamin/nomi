import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerationCanvasNode } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
const { state, snapshot } = vi.hoisted(() => ({ state: { nodes: [] as GenerationCanvasNode[], updateNode: vi.fn() }, snapshot: vi.fn() }))
vi.mock('react', () => ({ useEffect: (effect: () => unknown) => effect() }))
vi.mock('../src/desktop/bridge', () => ({ getDesktopBridge: () => ({ web: { generationSnapshot: snapshot } }) }))
vi.mock('../src/workbench/generationCanvas/store/generationCanvasStore', () => ({ useGenerationCanvasStore: { getState: () => state } }))
import { useWebGenerationSync } from '../src/workbench/generationCanvas/runner/useWebGenerationSync'

const result = { id: 'candidate-A', type: 'video' as const, createdAt: 1, url: 'old.mp4' }
const original: GenerationCanvasNode = { id: 'shot', kind: 'video', title: 'Shot', position: { x: 0, y: 0 }, status: 'success', result, history: [result], runs: [{ id: 'run-A', startedAt: 1, updatedAt: 1, status: 'success' }] }
beforeEach(() => {
  vi.stubGlobal('window', { setInterval: () => 1, clearInterval: () => undefined })
  state.nodes = [original]
  state.updateNode.mockReset().mockImplementation((id, patch) => { state.nodes = state.nodes.map(node => node.id === id ? { ...node, ...patch } : node) })
})
describe('web execution snapshot projection', () => {
  it('shows a missed failed run even when its previous successful candidate is known', async () => {
    const failed = { ...original, status: 'error', error: 'GPU failed', runs: [{ id: 'run-B', startedAt: 2, updatedAt: 2, status: 'error' }] }
    snapshot.mockResolvedValue([{ key: 'job-B', node: failed, isPending: false }])
    useWebGenerationSync('project')
    await Promise.resolve()
    expect(state.nodes[0]).toMatchObject({ status: 'error', error: 'GPU failed', runs: failed.runs })
  })
  it('keeps deliberate candidate selection after the same successful run was applied', async () => {
    state.nodes = [{ ...original, result: { ...result, id: 'chosen-old' }, history: [result] }]
    snapshot.mockResolvedValue([{ key: 'job-A', node: original, isPending: false }])
    useWebGenerationSync('project')
    await Promise.resolve()
    expect(state.updateNode).not.toHaveBeenCalled()
    expect(state.nodes[0].result?.id).toBe('chosen-old')
  })
})
