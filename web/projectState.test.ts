import { describe, expect, it } from 'vitest'
import { mergeServerResults } from './projectState'
import type { GenerationCanvasNode } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
const node: GenerationCanvasNode = { id: 'shot', kind: 'video', title: 'Shot', position: { x: 0, y: 0 }, result: { id: 'old', type: 'video', createdAt: 1, url: 'old.mp4' } }
const run = { id: 'run', startedAt: 1, updatedAt: 2 }
describe('server-owned generation fields survive stale browser saves', () => {
  it('preserves server failure and submission-unknown status for the same run', () => {
    const current: GenerationCanvasNode = { ...node, status: 'error', error: 'Submission unknown', runs: [{ ...run, status: 'error' }] }
    const incoming: GenerationCanvasNode = { ...node, status: 'running', runs: [{ ...run, status: 'running' }] }
    expect(mergeServerResults(current, incoming)).toMatchObject({ status: 'error', error: 'Submission unknown', runs: current.runs })
  })
  it('does not let browser timeout cancel an active server job', () => {
    const current: GenerationCanvasNode = { ...node, status: 'running', meta: { isWebGenerationOwned: true }, runs: [{ ...run, status: 'running' }] }
    expect(mergeServerResults(current, { ...current, status: 'error', error: 'Network lost' })).toMatchObject({ status: 'running', error: undefined })
  })
  it('keeps unseen candidates but permits a deliberate choice after seeing them', () => {
    const fresh = { id: 'fresh', type: 'video' as const, createdAt: 3, url: 'fresh.mp4' }
    const current: GenerationCanvasNode = { ...node, status: 'success', result: fresh, history: [fresh, node.result!] }
    expect(mergeServerResults(current, node).result?.id).toBe('fresh')
    expect(mergeServerResults(current, { ...node, status: 'success', history: current.history }).result?.id).toBe('old')
  })
})
