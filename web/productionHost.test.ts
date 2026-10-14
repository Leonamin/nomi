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
import { sourceStoryboardHash } from './sourceStoryboardExecution'
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
  it.each(['source', 'plan', 'keyframe', 'promptSegments', 'anchorIds'].flatMap(edited => [false, true].map(isPinned => ({ edited, isPinned }))))('rejects $edited edited during approval (durable pin=$isPinned)', async ({ edited, isPinned }) => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'canonical-document-run'
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const plan = storyboardPlanFromDraftSubjects([{ shotId: candidate.candidateId, candidate }], 'unused')
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    const run = host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate })
    if (isPinned) host.runtime.repository.execute(f.project.id, designId, { commandId: 'source-pin', expectedRevision: run.revision, type: 'generation.source_storyboard.pin', payload: { contentHash: sourceStoryboardHash(plan) }, issuedAt: new Date().toISOString() })
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

  it('refuses browser-forged source pins and pins without a source draft', async () => {
    const f = await fixture(), host = createWebProductionHost()
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    try {
      const run = host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: 'pin-without-source', origin: { host: 'nomi' }, candidate })
      const command = { commandId: 'forged-source-pin', expectedRevision: run.revision, type: 'generation.source_storyboard.pin', payload: { contentHash: 'a'.repeat(64) }, issuedAt: new Date().toISOString() }
      expect(() => host.runtime.repository.execute(f.project.id, run.runId, command)).toThrow('storyboard_pin_requires_source_draft')
      await expect(dispatchWebRpc('nomi:production-runs:command', [{ projectId: f.project.id, runId: run.runId, command }], f.surface)).rejects.toThrow()
      expect(host.runtime.repository.read(f.project.id, run.runId)!.generationPlan!.sourceStoryboardHash).toBeUndefined()
    } finally { host.runtime.dispose() }
  })

  it('persists the whole source author pin across a host restart and admits editorial fields', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'rich-pinned-source'
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const plan = storyboardPlanFromDraftSubjects([{ shotId: candidate.candidateId, candidate }], 'unused')
    plan.shots[0].anchorIds = ['editorial']
    plan.shots[0].promptSegments = [{ key: 'subject', start: 0, end: 3 }]
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } })
    const first = createWebProductionHost()
    try {
      const run = first.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate })
      first.runtime.repository.execute(f.project.id, designId, { commandId: 'pin-source', expectedRevision: run.revision, type: 'generation.source_storyboard.pin', payload: { contentHash: sourceStoryboardHash(plan) }, issuedAt: new Date().toISOString() })
    } finally { first.runtime.dispose() }
    const restored = createWebProductionHost()
    try {
      const lease = await restored.forSurface(f.surface).leaseFor(f.selected)
      await expect(restored.runtime.planning({ capability: 'present', lease, params: { operationId: designId } })).resolves.toMatchObject({ nextAction: 'await_user' })
      const record = readProject(f.project.id)!, payload = projectCanvas(record)
      await saveProject(f.project.id, { ...record, expectedBinding: f.agentBinding, payload: { ...payload, storyboardDesignsByDocumentId: { ...payload.storyboardDesignsByDocumentId, [document.id]: payload.storyboardDesignsByDocumentId[document.id].map(design => ({ ...design, plan: { ...design.plan, title: 'Changed while server restarted' } })) } } })
      await expect(restored.runtime.planning({ capability: 'present', lease, params: { operationId: designId } })).rejects.toThrow('storyboard_content_conflict')
    } finally { restored.runtime.dispose() }
  })

  it('keeps an approved card edit aligned with its source author plan through the same operation writer', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'source-card-edit'
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const plan = storyboardPlanFromDraftSubjects([{ shotId: candidate.candidateId, candidate }], 'unused')
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    try {
      const run = host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate })
      const edited = await host.runtime.operations.revise!(f.project.id, designId, { expectedRevision: run.revision, patch: { prompt: 'A lantern', parameters: { seed: 123 } } }, new Date().toISOString())
      expect(edited.runRevision).toBe(host.runtime.repository.read(f.project.id, designId)!.revision)
      const second = await host.runtime.operations.revise!(f.project.id, designId, { expectedRevision: edited.runRevision, patch: { prompt: 'A lantern' } }, new Date().toISOString())
      expect(second.runRevision).toBe(host.runtime.repository.read(f.project.id, designId)!.revision)
      const patched = await host.runtime.operations.patch(f.project.id, designId, { prompt: 'A glowing lantern' }, new Date().toISOString())
      expect(patched.runRevision).toBe(host.runtime.repository.read(f.project.id, designId)!.revision)
      await host.runtime.operations.revise!(f.project.id, designId, { expectedRevision: patched.runRevision, patch: { prompt: 'A lantern' } }, new Date().toISOString())
      const saved = projectCanvas(readProject(f.project.id)!).storyboardDesignsByDocumentId[document.id][0].plan.shots[0]
      expect(saved).toMatchObject({ prompt: 'A lantern', params: { seed: 123 } })
      expect(host.runtime.repository.read(f.project.id, designId)!.generationPlan!.candidate).toMatchObject({ prompt: 'A lantern', parameters: { seed: 123 } })
      const scope = host.forSurface(f.surface), lease = await scope.leaseFor(f.selected)
      await expect(host.runtime.planning({ capability: 'present', lease, params: { operationId: designId } })).resolves.toMatchObject({ nextAction: 'await_user' })
    } finally { host.runtime.dispose() }
  })

  it('normalizes source multi-shot parameters using real author row identity and atomic top mirrors', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'multi-row-normalization'
    const candidate = { candidateId: 'cand-shot-1', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Lantern', parameters: { duration: 5.167 }, references: [] }
    const shots = [{ shotId: 'shot-1', candidate }]
    const plan = storyboardPlanFromDraftSubjects(shots, 'unused')
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    try {
      host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate, shots })
      const changed = await host.runtime.operations.patch(f.project.id, designId, { parameters: {} }, new Date().toISOString())
      expect(changed.candidate).toEqual(changed.shots![0].candidate)
      expect(changed.shots![0].candidate.parameters).toEqual({})
      const sourcePlan = projectCanvas(readProject(f.project.id)!).storyboardDesignsByDocumentId[document.id][0].plan
      expect(sourcePlan.shots[0]).toMatchObject({ shotId: 'shot-1', params: {} })
      const lease = await host.forSurface(f.surface).leaseFor(f.selected)
      await expect(host.runtime.planning({ capability: 'present', lease, params: { operationId: designId } })).resolves.toMatchObject({ nextAction: 'await_user' })
    } finally { host.runtime.dispose() }
  })

  it('keeps author metadata only in the project when source operations are patched or revised from another view', async () => {
    const document = createDefaultWorkbenchDocument(), pin = documentSessionState(document), designId = 'multi-row-normalization'
    const candidate = { candidateId: 'cand-shot-1', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Lantern', parameters: { duration: 5.167 }, references: [] }
    const shots = [{ shotId: 'shot-1', candidate }]
    const plan = storyboardPlanFromDraftSubjects(shots, 'unused')
    const f = await fixture({ workbenchDocuments: [document], activeDocumentId: document.id, storyboardDesignsByDocumentId: { [document.id]: [{ id: designId, documentId: document.id, title: 'Plan', plan, committed: false, status: 'draft', sourceDocumentUpdatedAt: document.updatedAt, createdAt: 1, updatedAt: 1 }] } }), host = createWebProductionHost()
    try {
      host.runtime.repository.createGenerationDraft({ projectId: f.project.id, operationId: designId, origin: { host: 'nomi', sourceDocument: { documentId: document.id, revision: pin.revision, contentHash: pin.contentHash } }, candidate, shots })
      const author = { anchorIds: [], promptSegments: [{ key: 'segment-1', start: 0, end: 1 }] }
      const changed = await host.runtime.operations.patch(f.project.id, designId, { parameters: {}, storyboard: author }, new Date().toISOString())
      expect(changed.candidate.storyboard).toBeUndefined()
      const revised = await host.runtime.operations.revise!(f.project.id, designId, { expectedRevision: changed.runRevision, patch: { storyboard: author } }, new Date().toISOString())
      expect(revised.candidate.storyboard).toBeUndefined()
      expect(revised.shots![0].candidate.storyboard).toBeUndefined()
      expect(changed.candidate).toEqual(changed.shots![0].candidate)
      expect(changed.shots![0].candidate.parameters).toEqual({})
      const sourcePlan = projectCanvas(readProject(f.project.id)!).storyboardDesignsByDocumentId[document.id][0].plan
      expect(sourcePlan.shots[0]).toMatchObject({ shotId: 'shot-1', params: {}, promptSegments: author.promptSegments })
      const lease = await host.forSurface(f.surface).leaseFor(f.selected)
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
