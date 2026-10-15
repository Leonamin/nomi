import { describe, it, expect, vi } from 'vitest'
import { createWebSemanticAgentTools } from './semanticAgentTools'
import { captureGenerationContext } from '../electron/shared/agentCapabilities/generationInvocationContext'
import { modelFacingToolSpecs } from '../electron/shared/agentCapabilities/modelFacingToolRegistry'
import type { WebSemanticAgentToolDependencies } from './semanticAgentTools'
describe('native web semantic tool vocabulary', () => {
  const create = () => createWebSemanticAgentTools({ binding: { projectId: 'project', immutableProjectUuid: 'uuid', projectGeneration: 1 }, signal: new AbortController().signal,
    documentPort: { read: vi.fn(), write: vi.fn() }, generation: { readTask: vi.fn(async () => ({ runId: 'generation-job', status: 'completed' })), transport: { tryExecute: vi.fn(async () => ({ ok: true, result: {} })) } }, listModels: () => [], readCanvas: () => ({ nodes: [], edges: [], groups: [], selectedNodeIds: [] }) } as unknown as WebSemanticAgentToolDependencies)
  it('uses exact original names/schema and never restores retired production entrypoints', () => {
    const tools = create()
    expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['read_script', 'write_script', 'list_models', 'look_at_canvas', 'draft_shots', 'generate', 'check_job']))
    expect(tools.some(tool => tool.name === 'start_production_run' || tool.name === 'nomi_shot_generate')).toBe(false)
    for (const tool of tools.filter(tool => tool.name !== 'write_script')) expect(tool.schema).toBe(modelFacingToolSpecs('internal').find(spec => spec.name === tool.name)?.schema)
  })
  it('preserves irreversible cancellation and the original generation confirmation owner', () => {
    const tools = create()
    expect(tools.find(tool => tool.name === 'cancel_job')).toMatchObject({ approvalSubject: { effectClass: 'irreversible', destructiveHint: true }, hasDomainConfirmation: false })
    expect(tools.filter(tool => tool.hasDomainConfirmation).map(tool => tool.name)).toEqual(['generate'])
  })
  it('uses the same document/canvas source context semantics as the original desktop', () => {
    expect(captureGenerationContext({ admissionSurface: 'canvas', documentId: 'visible-doc', preconditions: { document: { revision: 1, contentHash: 'hash' } } })).toBeUndefined()
    expect(captureGenerationContext({ admissionSurface: 'document', documentId: 'doc', preconditions: { document: { revision: 1, contentHash: 'hash' } } })).toMatchObject({ sourceDocument: { documentId: 'doc', revision: 1, contentHash: 'hash' } })
  })
  it('keeps export and generation task references in their declared domain', async () => {
    const tools = create(), check = tools.find(tool => tool.name === 'check_job')!
    await expect(check.run({ domain: 'export', jobId: 'export-job' })).rejects.toThrow('generation-domain')
    await expect(check.run({ domain: 'generation', jobId: 'generation-job' })).resolves.toMatchObject({ task: { runId: 'generation-job', status: 'completed' } })
  })
  it.each(['native-turn-ended', 'user-stopped'])('preserves the pending card on native timeout and withdraws only explicit stop (%s)', async reason => {
    const controller = new AbortController(), onApprovalWaiting = vi.fn(), withdrawPresentation = vi.fn(async () => undefined)
    const transport = { tryExecute: vi.fn(async () => ({ ok: true, result: { nextAction: 'await_user' } })), withdrawPresentation }
    const tools = createWebSemanticAgentTools({ binding: { projectId: 'project', immutableProjectUuid: 'uuid', projectGeneration: 1 }, signal: controller.signal, documentPort: { read: vi.fn(), write: vi.fn() }, generation: { transport }, onApprovalWaiting, listModels: () => [], readCanvas: () => ({ nodes: [], edges: [] }) } as unknown as WebSemanticAgentToolDependencies)
    const generation = tools.find(tool => tool.name === 'generate')!.run({ operationId: 'pending-original-operation' })
    await vi.waitFor(() => expect(onApprovalWaiting).toHaveBeenCalledWith(true))
    controller.abort(reason)
    await expect(generation).resolves.toMatchObject({ ok: false, code: 'generation_cancelled' })
    expect(withdrawPresentation).toHaveBeenCalledTimes(reason === 'user-stopped' ? 1 : 0)
    expect(onApprovalWaiting).toHaveBeenLastCalledWith(false)
  })

  it('rejects browser selection and cursor writes before they can become whole-document replacement', async () => {
    const write = create().find(tool => tool.name === 'write_script')!
    expect(write.description).toContain('whole-document')
    for (const where of ['cursor', 'selection']) await expect(write.run({ content: 'Partial edit', where })).rejects.toThrow()
  })

})


describe('web document tool scope and receipts', () => {
  it('advertises only supported scopes and requires a read before whole document replacement', async () => {
    const onDocumentExecuted = vi.fn(), read = vi.fn(async()=>({text:'original'})), write = vi.fn(async()=>({applied:true as const,revision:2,contentHash:'verified'}))
    const tools=createWebSemanticAgentTools({binding:{projectId:'p',immutableProjectUuid:'u',projectGeneration:1},signal:new AbortController().signal,onDocumentExecuted,documentPort:{read,write},generation:{},listModels:()=>[],readCanvas:()=>({})} as unknown as WebSemanticAgentToolDependencies)
    const edit=tools.find(t=>t.name==='write_script')!
    expect(edit.schema.safeParse({where:'whole-document',content:'revised'}).success).toBe(true)
    expect(edit.schema.safeParse({where:'selection',content:'revised'}).success).toBe(false)
    await expect(edit.run({where:'whole-document',content:'revised'})).rejects.toThrow('read_script')
    expect(write).not.toHaveBeenCalled()
    await tools.find(t=>t.name==='read_script')!.run({scope:'full'})
    expect(onDocumentExecuted).toHaveBeenCalledOnce()
    await expect(edit.run({where:'whole-document',content:'revised'})).resolves.toMatchObject({ok:true,details:{applied:true,revision:2,contentHash:'verified'}})
    expect(write).toHaveBeenCalledWith({operation:'replace',content:'revised'},expect.anything())
  })
})
