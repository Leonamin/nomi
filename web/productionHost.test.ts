import { describe, it, expect, vi } from 'vitest'
import { createDefaultWorkbenchDocument } from '../src/workbench/workbenchTypes'
import { storyboardPlanFromDraftSubjects } from '../electron/capabilityCore/mcpGenerationMultiShot'
import { createEmptyStoryboardPlan } from '../src/workbench/generationCanvas/agent/storyboardPlan'
import { documentSessionState, applyWholeDocumentWrite } from '../src/workbench/project/documentSessionCore'
import { projectCanvas } from './projectState'
import { hostEvents } from './runtimeHost'
import { readProject, saveProject, createProject } from '../electron/projects/repository'
import { createWebSurface } from './surface'
import { createWebProductionHost } from './productionHost'
import { dispatchWebRpc } from './rpc'
import { DEFAULT_PROJECT_AGENT_APPROVAL_POLICY } from '../electron/shared/agentCapabilities/capabilityApprovalPolicy'
async function fixture(payload?: unknown) {
  const project = createProject({ name: 'Production host integration', ...(payload ? { payload } : {}) }), surface = createWebSurface('http://localhost')
  const suspension = surface.suspend({ surfaceInstanceId: crypto.randomUUID() }).value.suspension
  const binding = (await surface.commit({ projectId: project.id, suspension })).value.binding
  const selected = surface.registry.getCommittedProjectSelection()!
  const agentBinding = { projectId: selected.projectId, immutableProjectUuid: selected.immutableProjectUuid, projectGeneration: selected.projectGeneration }
  return { project, surface, binding, selected, agentBinding }
}
describe('actual web production host integration', () => {
  it('routes browser plan preview through the same planning seam and rejects another project', async () => {
    const f = await fixture()
    const result = await dispatchWebRpc('nomi:generation:resolve-plan', [{ projectId: 'another-project', shots: [] }], f.surface)
    expect(result).toMatchObject({ ok: false, error: { code: 'project_binding_stale' } })
  })

  it('caches only the same committed selection and retires old transport after release/recommit', async () => {
    const f = await fixture(), host = createWebProductionHost()
    try {
      const original = host.forSurface(f.surface)
      expect(host.forSurface(f.surface)).toBe(original)
      await expect(original.leaseFor(f.selected)).resolves.toMatchObject({ projectId: f.project.id })
      f.surface.release({ authority: f.binding })
      await expect(original.leaseFor(f.selected)).rejects.toThrow('project_binding_stale')
      const suspension = f.surface.suspend({ surfaceInstanceId: crypto.randomUUID() }).value.suspension
      await f.surface.commit({ projectId: f.project.id, suspension })
      expect(host.forSurface(f.surface)).not.toBe(original)
      await expect(original.leaseFor(f.selected)).rejects.toThrow('project_binding_stale')
    } finally { host.runtime.dispose() }
  })
  it('uses actual document ports and refuses a fabricated storyboard source pin', async () => {
    const f = await fixture(), host = createWebProductionHost()
    try {
      await expect(host.tools(f.surface, f.agentBinding, { approvalPolicy: DEFAULT_PROJECT_AGENT_APPROVAL_POLICY, documentId: 'foreign-doc', storyboardTarget: { projectId: f.project.id, sourceDocumentId: 'foreign-doc', sourceDocumentRevision: 1, sourceDocumentContentHash: 'fake', targetKind: 'storyboard', requestId: 'request', plans: [] } }, new AbortController().signal)).rejects.toThrow()
      const tools = await host.tools(f.surface, f.agentBinding, { approvalPolicy: DEFAULT_PROJECT_AGENT_APPROVAL_POLICY }, new AbortController().signal)
      expect(tools.tools.map(tool => tool.name)).toContain('generate')
      await expect(tools.tools.find(tool => tool.name === 'look_at_canvas')!.run({})).resolves.toMatchObject({ ok: true, details: { nodeCount: 0 } })
    } finally { host.runtime.dispose() }
  })
  it('routes pending spend to the real owner and rejects foreign projects for read and mutation', async () => {
    const f = await fixture(), host = createWebProductionHost()
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const run = host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: 'actual-durable-draft', origin: { host: 'nomi' }, candidate })
    await expect(dispatchWebRpc('nomi:production-runs:read', [{ projectId: f.project.id, runId: run.runId }], f.surface)).resolves.toMatchObject({ runId: run.runId, generationPlan: { candidate: { prompt: 'Fox' } } })
    await expect(dispatchWebRpc('nomi:production-runs:pending-spend', [{ projectId: f.project.id }], f.surface)).resolves.toMatchObject({ surface: 'ready', rows: [expect.objectContaining({ operationId: run.runId })] })
    await expect(dispatchWebRpc('nomi:production-runs:list', [{ projectId: f.project.id }], f.surface)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ runId: run.runId })]))
    await expect(dispatchWebRpc('nomi:production-runs:read', [{ projectId: 'foreign', runId: 'run' }], f.surface)).rejects.toThrow('another project')
    await expect(dispatchWebRpc('nomi:production-runs:confirm-spend', [{ projectId: 'foreign', operationId: 'run', quoteId: 'quote' }], f.surface)).rejects.toThrow('another project')
    host.runtime.dispose()
  })
  it.each(['source', 'plan', 'keyframe', 'promptSegments', 'anchorIds'])('presents document drafts through the durable Run and rejects a %s edited during approval', async edited => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'canonical-document-run'
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const plan = storyboardPlanFromDraftSubjects([{ shotId: candidate.candidateId, candidate }], 'unused')
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate })
    try {
      const scope = host.forSurface(f.surface), lease = await scope.leaseFor(f.selected)
      await expect(host.runtime.planning({ capability: 'present', lease, params: { operationId: designId } })).resolves.toMatchObject({ nextAction: 'await_user' })
      const pending = scope.pendingSpend.listPendingSpend(f.project.id)
      expect(pending).toHaveLength(1)
      const record = readProject(f.project.id)!, payload = projectCanvas(record)
      await saveProject(f.project.id, { ...record, expectedBinding: f.agentBinding, payload: edited === 'source' ? { ...payload, workbenchDocuments: payload.workbenchDocuments!.map(value => applyWholeDocumentWrite(value, 'append', 'Human changed the source while approval was waiting')) } : { ...payload, storyboardDesignsByDocumentId: { ...payload.storyboardDesignsByDocumentId, [document.id]: payload.storyboardDesignsByDocumentId[document.id].map(design => ({ ...design, plan: { ...design.plan, shots: design.plan.shots.map(shot => ({ ...shot, ...(edited === 'plan' ? { prompt: 'Human revised execution prompt' } : { [edited]: edited === 'anchorIds' ? ['new-anchor'] : edited === 'promptSegments' ? [{ text: 'Human revised prompt segment' }] : { prompt: 'Human revised keyframe' } }) })) } })) } } })
      const result = await scope.pendingSpend.confirmPendingSpend({ projectId: f.project.id, operationId: designId, quoteId: pending[0].quoteId })
      expect(result.ok).toBe(false)
      expect(host.runtime.repository.read(f.project.id, designId)!.jobs).toHaveLength(0)
      await expect(host.runtime.planning({ capability: 'withdraw', lease, params: { operationId: designId, reason: 'user_closed' } })).resolves.toMatchObject({ nextAction: 'present' })
      expect(scope.pendingSpend.listPendingSpend(f.project.id)).toHaveLength(0)
    } finally { host.runtime.dispose() }
  })

  it('keeps an approved card edit aligned with its source author plan through the same operation writer', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'source-card-edit'
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const plan = storyboardPlanFromDraftSubjects([{ shotId: candidate.candidateId, candidate }], 'unused')
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    try {
      const run = host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate })
      await host.runtime.operations.revise!(f.project.id, designId, { expectedRevision: run.revision, patch: { prompt: 'A lantern', parameters: { seed: 123 } } }, new Date().toISOString())
      const saved = projectCanvas(readProject(f.project.id)!).storyboardDesignsByDocumentId[document.id][0].plan.shots[0]
      expect(saved).toMatchObject({ prompt: 'A lantern', params: { seed: 123 } })
      expect(host.runtime.repository.read(f.project.id, designId)!.generationPlan!.candidate).toMatchObject({ prompt: 'A lantern', parameters: { seed: 123 } })
      const scope = host.forSurface(f.surface), lease = await scope.leaseFor(f.selected)
      await expect(host.runtime.planning({ capability: 'present', lease, params: { operationId: designId } })).resolves.toMatchObject({ nextAction: 'await_user' })
    } finally { host.runtime.dispose() }
  })

  it('advances only its own successful document write pin and rejects an unread human source edit', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document)
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: {} }), host = createWebProductionHost()
    const messages = vi.fn(), listener = (message: { channel: string }) => { if (message.channel === 'nomi:capability:apply') messages(message) }
    hostEvents.on('message', listener)
    try {
      const tools = await host.tools(f.surface, f.agentBinding, { approvalPolicy: DEFAULT_PROJECT_AGENT_APPROVAL_POLICY, admissionSurface: 'document', documentId: document.id, preconditions: { document: pin } }, new AbortController().signal)
      const written = await tools.tools.find(tool => tool.name === 'write_script')!.run({ content: 'Own finished script', where: 'end' })
      expect((written as { failure?: unknown }).failure).toBeUndefined()
      expect(written).toMatchObject({ ok: true })
      const saved = projectCanvas(readProject(f.project.id)!).workbenchDocuments!.find(value => value.id === document.id)!
      const ownPin = documentSessionState(saved)
      expect(tools.context.preconditions?.document).toMatchObject({ revision: ownPin.revision, contentHash: ownPin.contentHash })
      expect(saved.contentJson).toMatchObject({ content: expect.arrayContaining([expect.objectContaining({ content: expect.arrayContaining([expect.objectContaining({ text: 'Own finished script' })]) })]) })
      expect(ownPin.contentHash).not.toBe(pin.contentHash)
      const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
      host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: 'fresh-source-operation', origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: ownPin.revision, contentHash: ownPin.contentHash } }, candidate })
      const record = readProject(f.project.id)!, payload = projectCanvas(record)
      await saveProject(f.project.id, { ...record, expectedBinding: f.agentBinding, payload: { ...payload, workbenchDocuments: payload.workbenchDocuments!.map(value => value.id === document.id ? applyWholeDocumentWrite(value, 'append', 'Unread human change') : value) } })
      const result = await tools.tools.find(tool => tool.name === 'generate')!.run({ operationId: 'fresh-source-operation' })
      expect(result).toMatchObject({ ok: false })
      expect(messages).not.toHaveBeenCalled()
      expect(tools.context.preconditions?.document?.contentHash).toBe(ownPin.contentHash)
    } finally { hostEvents.off('message', listener); host.runtime.dispose() }
  })

  it('refuses a storyboard changed by a human after this turn was admitted', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), plan = createEmptyStoryboardPlan(), designId = 'human-plan-change'
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate })
    const messages = vi.fn(), listener = (message: { channel: string }) => { if (message.channel === 'nomi:capability:apply') messages(message) }
    hostEvents.on('message', listener)
    try {
      const tools = await host.tools(f.surface, f.agentBinding, { approvalPolicy: DEFAULT_PROJECT_AGENT_APPROVAL_POLICY, admissionSurface: 'document', documentId: document.id, preconditions: { document: pin } }, new AbortController().signal)
      const record = readProject(f.project.id)!, payload = projectCanvas(record)
      await saveProject(f.project.id, { ...record, expectedBinding: f.agentBinding, payload: { ...payload, storyboardDesignsByDocumentId: { ...payload.storyboardDesignsByDocumentId, [document.id]: payload.storyboardDesignsByDocumentId[document.id].map(design => ({ ...design, plan: { ...design.plan, title: 'Human revised plan' } })) } } })
      await expect(tools.tools.find(tool => tool.name === 'generate')!.run({ operationId: designId })).resolves.toMatchObject({ ok: false })
      expect(messages).not.toHaveBeenCalled()
    } finally { hostEvents.off('message', listener); host.runtime.dispose() }
  })

})
