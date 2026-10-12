import { describe, it, expect } from 'vitest'
import { applyWholeDocumentWrite, workbenchDocumentPlainText } from '../src/workbench/project/documentSessionCore'
import { createDefaultWorkbenchDocument } from '../src/workbench/workbenchTypes'
import type { ProjectRecord } from '../electron/projects/repository'
import { projectCanvas } from './projectState'
import { createDefaultGenerationCanvasSnapshot } from '../src/workbench/generationCanvas/store/generationCanvasDefaults'
import { createEmptyStoryboardPlan } from '../src/workbench/generationCanvas/agent/storyboardPlan'
import { createWebProductionProjectPort } from './productionProjectPort'

describe('web canonical creation project port', () => {
  it('uses the same markdown document owner without a browser editor', () => {
    const document = createDefaultWorkbenchDocument()
    const next = applyWholeDocumentWrite(document, 'replace', '# 제목\n\n원고 **본문**')
    expect(workbenchDocumentPlainText(next)).toBe('제목\n원고 본문')
    expect(() => applyWholeDocumentWrite(next, 'insert', '위치 없는 삽입')).toThrow('capability_unsupported')
  })
  it('exports a server project port rather than borrowing the active renderer store', () => {
    expect(createWebProductionProjectPort).toBeTypeOf('function')
  })
})

const binding = { projectId: 'project-test', immutableProjectUuid: 'f78f035b-360f-4c2b-b070-bd72d2fbefcd', projectGeneration: 1 }
function fixture() {
  const document = createDefaultWorkbenchDocument()
  let current: ProjectRecord = { id: binding.projectId, name: '테스트', version: 1, createdAt: 1, updatedAt: 1, payload: { workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: {}, generationCanvas: createDefaultGenerationCanvasSnapshot(), timeline: { tracks: [], clips: [] } } }
  let saves = 0
  const port = createWebProductionProjectPort(binding, {
    readProject: () => current,
    saveProject: async (_id, input) => { expect(input).toMatchObject({ expectedBinding: binding }); current = input as ProjectRecord; saves += 1; return current },
    assertBinding: () => {},
  })
  return { port, document, current: () => current, saves: () => saves }
}
const context = () => ({ signal: new AbortController().signal, toolCallId: 'tool-call' })
describe('project pinned durable creation writes', () => {
  it('rejects fabricated selections and position writes, persists whole document markdown with managed identity', async () => {
    const test = fixture()
    await expect(test.port.documentPort.read('selection', context())).rejects.toThrow('capability_unsupported')
    await expect(test.port.documentPort.write({ operation: 'insert', content: '위치' }, context())).rejects.toThrow('capability_unsupported')
    await test.port.documentPort.write({ operation: 'replace', content: '# 제목\n\n본문' }, context())
    expect(await test.port.documentPort.read('full', context())).toEqual({ text: '제목\n본문' })
    expect(test.current().payload).toMatchObject({ webManagedCreation: { documents: { [test.document.id]: true } } })
    expect(test.saves()).toBe(1)
  })
  it('rejects stale document preconditions at the serialized write boundary', async () => {
    const test = fixture()
    const state = test.port.readDocumentState()
    await test.port.documentPort.write({ operation: 'append', content: 'human edit' }, context())
    await expect(test.port.requestRenderer('document.write', { projectId: binding.projectId, target: { kind: 'document', documentId: test.document.id, anchor: { kind: 'whole-document' } }, preconditions: { document: state }, operation: 'replace', content: 'old turn' })).rejects.toThrow('surface_port_stale')
    expect(await test.port.documentPort.read('full', context())).toEqual({ text: 'human edit' })
  })
  it('freezes the admitted document and rejects human edits made while the model is thinking', async () => {
    const test = fixture()
    const payload = projectCanvas(test.current())
    payload.workbenchDocuments![0] = applyWholeDocumentWrite(test.document, 'replace', 'human edit during model turn')
    await expect(test.port.documentPort.write({ operation: 'replace', content: 'model overwrite' }, context())).rejects.toThrow('surface_port_stale')
    expect(workbenchDocumentPlainText(payload.workbenchDocuments![0])).toBe('human edit during model turn')
  })
  it('stores canonical agent storyboard without changing the active document', async () => {
    const test = fixture()
    const plan = { ...createEmptyStoryboardPlan(), title: '웹 계획' }
    await test.port.requestRenderer('storyboard.upsert-design', { projectId: binding.projectId, documentId: test.document.id, designId: 'design-1', plan, initiator: 'agent' })
    expect(projectCanvas(test.current()).storyboardDesignsByDocumentId?.[test.document.id][0]).toMatchObject({ id: 'design-1', title: '웹 계획', sourceDocumentUpdatedAt: test.document.updatedAt })
    expect(test.current().payload).toMatchObject({ webManagedCreation: { designs: { 'design-1': true } } })
  })
  it('materializes anchors first, replays without another save, and never recreates a detached shot', async () => {
    const test = fixture()
    const payload = { projectId: binding.projectId, runId: 'run-1', materializationOperationId: 'op-1', shots: [{ shotId: 'shot-1', role: 'shot', title: '샷', prompt: 'shot' }, { shotId: 'anchor-1', role: 'anchor', title: '참조', prompt: 'anchor' }] }
    const first = await test.port.requestRenderer('production.materialize-shots', payload) as { createdNodeIds: string[] }
    expect(first.createdNodeIds).toHaveLength(2)
    const nodes = projectCanvas(test.current()).generationCanvas.nodes
    expect(nodes[0]).toMatchObject({ title: '참조', meta: { referenceSheet: true } })
    expect(nodes[0].shotIndex).toBeUndefined()
    expect(nodes[1].shotIndex).toBe(1)
    await test.port.requestRenderer('production.materialize-shots', payload)
    expect(test.saves()).toBe(1)
    const next = projectCanvas(test.current())
    next.generationCanvas.nodes = next.generationCanvas.nodes.filter(node => node.id !== first.createdNodeIds[1])
    await test.port.requestRenderer('production.materialize-shots', { ...payload, shots: payload.shots.map(shot => ({ ...shot, existingOnly: true })) })
    expect(projectCanvas(test.current()).generationCanvas.nodes.some(node => node.id === first.createdNodeIds[1])).toBe(false)
  })
  it('persists state-only result delivery and preserves an older selected candidate on replay', async () => {
    const test = fixture()
    const initial = { projectId: binding.projectId, materializationOperationId: 'op-2', shots: [{ shotId: 'shot-1', title: '샷', prompt: 'original' }] }
    await test.port.requestRenderer('production.materialize-shots', initial)
    const result = { id: 'new-result', type: 'video', createdAt: 100, url: 'nomi-local://assets/new.mp4' }
    await test.port.requestRenderer('production.materialize-shots', { ...initial, shots: [{ ...initial.shots[0], result }] })
    expect(test.saves()).toBe(2)
    const node = projectCanvas(test.current()).generationCanvas.nodes[0]
    node.result = { id: 'old-result', type: 'video', createdAt: 50, url: 'nomi-local://assets/old.mp4' }
    node.history = [...node.history!, node.result]
    await test.port.requestRenderer('production.materialize-shots', { ...initial, shots: [{ ...initial.shots[0], result }] })
    expect(projectCanvas(test.current()).generationCanvas.nodes[0].result?.id).toBe('old-result')
    expect(test.saves()).toBe(2)
  })
  it('preserves a user generation in flight and only rebinds a newer candidate revision', async () => {
    const test = fixture()
    const payload = { projectId: binding.projectId, materializationOperationId: 'op-3', shots: [{ shotId: 'shot', title: '샷', prompt: 'original', candidate: { candidateId: 'candidate', revision: 1 } }] }
    await test.port.requestRenderer('production.materialize-shots', payload)
    const node = projectCanvas(test.current()).generationCanvas.nodes[0]
    node.prompt = 'user prompt'
    node.status = 'running'
    node.runs = [{ id: 'user-run', status: 'running', startedAt: 100, updatedAt: 100 }]
    await test.port.requestRenderer('production.materialize-shots', { ...payload, shots: [{ ...payload.shots[0], generation: { state: 'failed', runRecordId: 'production:job', startedAt: 101 } }] })
    expect(projectCanvas(test.current()).generationCanvas.nodes[0]).toMatchObject({ prompt: 'user prompt', status: 'running', runs: [{ id: 'user-run' }] })
    await test.port.requestRenderer('production.materialize-shots', { ...payload, shots: [{ ...payload.shots[0], prompt: 'new intent', candidate: { candidateId: 'candidate', revision: 2 } }] })
    expect(projectCanvas(test.current()).generationCanvas.nodes[0].prompt).toBe('new intent')
  })
})

it('materializes canvas-only projects without requiring a mounted or persisted creation document', async () => {
  let current: ProjectRecord = { id: binding.projectId, name: 'canvas only', version: 1, createdAt: 1, updatedAt: 1, payload: { generationCanvas: createDefaultGenerationCanvasSnapshot(), timeline: { tracks: [], clips: [] } } }
  const port = createWebProductionProjectPort(binding, { readProject: () => current, saveProject: async (_id, next) => { current = next as ProjectRecord; return current }, assertBinding: () => {} })
  await expect(port.requestRenderer('production.materialize-shots', { projectId: binding.projectId, materializationOperationId: 'canvas-only', shots: [{ shotId: 'shot', title: '샷', prompt: '밤 거리' }] })).resolves.toMatchObject({ createdNodeIds: [expect.any(String)] })
  expect(projectCanvas(current).generationCanvas.nodes).toHaveLength(1)
})
