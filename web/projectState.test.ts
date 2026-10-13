import { describe, expect, it } from 'vitest'
import { mergeServerResults, projectCanvas } from './projectState'
import type { ProjectRecord } from '../electron/projects/repository'
import type { GenerationCanvasNode } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
const node: GenerationCanvasNode = { id: 'shot', kind: 'video', title: 'Shot', position: { x: 0, y: 0 }, result: { id: 'old', type: 'video', createdAt: 1, url: 'old.mp4' } }
const run = { id: 'run', startedAt: 1, updatedAt: 2 }
describe('server-owned generation fields survive stale browser saves', () => {
  it('accepts the first browser-created run when no server run exists', () => {
    const current: GenerationCanvasNode = { ...node, status: 'idle', runs: undefined }
    const incoming: GenerationCanvasNode = { ...node, status: 'queued', runs: [{ ...run, status: 'queued' }] }
    expect(mergeServerResults(current, incoming)).toMatchObject({ status: 'queued', runs: incoming.runs })
  })
  it('accepts a newer deliberate run after a terminal server run', () => {
    const current: GenerationCanvasNode = { ...node, status: 'error', runs: [{ ...run, status: 'error' }] }
    const incoming: GenerationCanvasNode = { ...node, status: 'queued', runs: [{ ...run, id: 'next', startedAt: 3, status: 'queued' }] }
    expect(mergeServerResults(current, incoming)).toMatchObject({ status: 'queued', runs: incoming.runs })
  })
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
describe('server canvas tolerates a freshly created project', () => {
  it('lays the default canvas over a payload which has none yet', () => {
    const record = { id: 'fresh', payload: { workbenchDocuments: [] } } as unknown as ProjectRecord
    const payload = projectCanvas(record)
    expect(payload.generationCanvas.nodes).toEqual([])
    expect(payload.timeline).toBeTruthy()
  })
})
