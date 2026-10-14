import { AsyncLocalStorage } from 'node:async_hooks'
import { assertDocumentWritePreconditions } from '../src/workbench/creation/documentWriteTarget'
import { documentSessionState } from '../src/workbench/project/documentSessionCore'
import { stableProjectAgentJson } from '../electron/shared/legacyAgentJson'
import { storyboardPlanFromDraftSubjects } from '../electron/capabilityCore/mcpGenerationMultiShot'
import { resolveIndexedReferencePreview } from '../electron/capabilityCore/pendingSpendReferences'
import { createWebProductionRuntime } from './productionRuntime'
import { createWebProductionProjectPort } from './productionProjectPort'
import { createWebSemanticAgentTools } from './semanticAgentTools'
import { readCatalog } from '../electron/catalog/catalogStore'
import { agentModelEntriesFromCatalog } from '../electron/catalog/agentModelEntriesFromCatalog'
import { listModelSpecRows, installCatalogRowLookup } from '../electron/capabilityCore/modelSpecRead'
import { isComfyuiVendor } from '../electron/catalog/types'
import { projectDirById, listProjects } from '../electron/projects/repository'
import { readWorkspaceManifest } from '../electron/workspace/workspaceManifest'
import { sameProjectAgentBinding, type ProjectBinding } from '../electron/shared/projectBinding'
import type { CurrentProjectSelection } from '../electron/capabilityCore/currentProjectResolver'
import type { LaneComposerContext } from '../electron/shared/agentLane/laneDesktopContracts'
import type { createWebSurface } from './surface'
import { hostEvents } from './runtimeHost'
import { projectCanvas } from './projectState'
import { readProject, type ProjectRecord } from '../electron/projects/repository'

type Surface = ReturnType<typeof createWebSurface>
function usableModels() {
  return agentModelEntriesFromCatalog(readCatalog()).filter(row => row.availability.usable && isComfyuiVendor({ key: row.entry.vendor ?? undefined }) && ['image', 'video'].includes(row.entry.kind ?? ''))
}
function projectBinding(projectId: string): ProjectBinding {
  const directory = projectDirById(projectId), manifest = directory ? readWorkspaceManifest(directory) : null
  if (!manifest?.immutableProjectUuid || typeof manifest.projectGeneration !== 'number') throw new Error('Project identity unavailable')
  return { projectId, immutableProjectUuid: manifest.immutableProjectUuid, projectGeneration: manifest.projectGeneration }
}
/** One durable host owns Runs. Browser scopes carry only their committed authority and gesture. */
export function createWebProductionHost() {
  const admissions = new AsyncLocalStorage<{ surface: Surface; binding: ProjectBinding; signal: AbortSignal; onApprovalWaiting?: (isWaiting: boolean) => void; designs: Map<string, string | undefined> }>()
  const planOf = (projectId: string, documentId: string, designId: string) => { const record = readProject(projectId); return record ? projectCanvas(record).storyboardDesignsByDocumentId?.[documentId]?.find(design => design.id === designId)?.plan : undefined }
  const planHash = (plan: unknown) => plan === undefined ? undefined : stableProjectAgentJson(JSON.parse(JSON.stringify(plan)))
  const notify = (projectId: string) => hostEvents.emit('message', { channel: 'nomi:web:production-changed', payload: { projectId } })
  const portFor = (binding: ProjectBinding, options: Parameters<typeof createWebProductionProjectPort>[1] = {}) => createWebProductionProjectPort(binding, {
    listModels: async () => usableModels().map(row => row.entry), orderedVendors: async () => readCatalog().vendors.filter(isComfyuiVendor).map(vendor => vendor.key), onChange: notify, ...options,
  })
  const runtime = createWebProductionRuntime({ isProjectOpen: projectId => Boolean(projectDirById(projectId)),
    requestRenderer: async (operation, payload, timeoutMs) => {
      const projectId = payload && typeof payload === 'object' ? (payload as { projectId?: unknown }).projectId : undefined
      if (typeof projectId !== 'string') throw new Error('Project is required for production writes')
      const input = payload as Record<string, unknown>
      const admission = admissions.getStore()
      const options = operation.startsWith('storyboard.') ? { beforeStoryboardWrite: (current: ProjectRecord) => {
        const run = runtime.repository.read(projectId, String(input.designId)), source = run?.origin.sourceDocument
        if (!source || input.documentId !== source.documentId) throw new Error('Storyboard source mismatch')
        const document = projectCanvas(current).workbenchDocuments?.find(value => value.id === source.documentId)
        if (!document) throw new Error('Storyboard source unavailable')
        assertDocumentWritePreconditions({ revision: source.revision, contentHash: source.contentHash }, documentSessionState(document))
        if (admission && !sameProjectAgentBinding(admission.binding, projectBinding(projectId))) throw new Error('Storyboard admission unavailable')
        const key = `${source.documentId}/${String(input.designId)}`
        if (admission && planHash(projectCanvas(current).storyboardDesignsByDocumentId?.[source.documentId]?.find(design => design.id === input.designId)?.plan) !== admission.designs.get(key)) throw new Error('storyboard_content_conflict')
      }, onChange: (id: string) => {
        if (admission && typeof input.documentId === 'string' && typeof input.designId === 'string') admission.designs.set(`${input.documentId}/${input.designId}`, planHash(planOf(id, input.documentId, input.designId)))
        notify(id)
      } } : {}
      return portFor(projectBinding(projectId), options).requestRenderer(operation, payload, timeoutMs)
    }, assertDocumentOperation: (projectId, operationId) => {
      const admission = admissions.getStore(), run = runtime.repository.read(projectId, operationId), source = run?.origin.sourceDocument
      if (!source || !run?.generationPlan) return
      const plan = planOf(projectId, source.documentId, operationId)
      if (admission && planHash(plan) !== admission.designs.get(`${source.documentId}/${operationId}`)) throw new Error('storyboard_content_conflict')
      if (!plan) throw new Error('storyboard_source_plan_unavailable')
      const generation = run.generationPlan
      const subjects = generation.shots?.length ? generation.shots : [{ shotId: generation.candidate.candidateId, candidate: generation.candidate }]
      const expected = storyboardPlanFromDraftSubjects(subjects, projectId, resolveIndexedReferencePreview)
      const execution = (value: Record<string, unknown>) => Object.fromEntries(['id', 'shotId', 'prompt', 'description', 'shotKind', 'modelKey', 'modelVendor', 'modeId', 'params', 'durationSec', 'referenceBindings', 'anchorIds', 'keyframe', 'promptSegments'].map(key => [key, value[key] ?? (key === 'params' || key === 'referenceBindings' ? {} : null)]))
      const rows = (value: typeof plan) => [...value.anchors, ...value.shots].map(subject => execution(subject as unknown as Record<string, unknown>))
      if (planHash(rows(plan)) !== planHash(rows(expected))) throw new Error('storyboard_execution_conflict')
    }, onRunChanged: run => { hostEvents.emit('message', { channel: 'nomi:production-runs:changed', payload: { projectId: run.projectId, runId: run.runId } }); notify(run.projectId) } })
  const scopes = new WeakMap<CurrentProjectSelection, ReturnType<typeof runtime.forSurface>>()
  function forSurface(surface: Surface) {
    const selection = surface.registry.getCommittedProjectSelection()
    if (!selection) throw new Error('Open a project before accessing production')
    let scope = scopes.get(selection)
    if (!scope) {
      scope = runtime.forSurface(selection, { getCommittedSelection: () => surface.registry.getCommittedProjectSelection(),
        getGestureTarget: () => surface.registry.getCommittedProjectSelection() === selection ? { surfaceId: surface.surfaceId, clientSessionId: surface.clientSessionId, origin: surface.origin } : null })
      scopes.set(selection, scope)
    }
    return scope
  }
  async function tools(surface: Surface, binding: ProjectBinding, context: LaneComposerContext, signal: AbortSignal, onApprovalWaiting?: (isWaiting: boolean) => void) {
    const selection = surface.registry.getCommittedProjectSelection()
    if (!selection || !sameProjectAgentBinding(binding, selection)) throw new Error('project_binding_stale')
    const port = portFor(binding, { documentId: context.documentId, documentPreconditions: context.preconditions?.document,
      assertBinding: () => { if (surface.registry.getCommittedProjectSelection() !== selection) throw new Error('project_binding_stale') } })
    if (context.storyboardTarget) {
      const target = context.storyboardTarget, state = port.readDocumentState(target.sourceDocumentId)
      if (target.projectId !== binding.projectId || context.documentId !== target.sourceDocumentId || target.sourceDocumentRevision !== state.revision || target.sourceDocumentContentHash !== state.contentHash || context.preconditions?.document?.revision !== state.revision || context.preconditions.document.contentHash !== state.contentHash) throw new Error('Storyboard source mismatch')
    }
    const admittedContext = { ...context, availableModels: usableModels().map(row => row.entry) }
    const domain = createWebSemanticAgentTools({ binding, signal, documentPort: port.documentPort, generation: forSurface(surface), context: admittedContext, onApprovalWaiting,
      onDocumentExecuted: () => {
        const pin = port.readAdmittedDocumentState()
        if (!pin?.contentHash) return
        admittedContext.preconditions = { ...admittedContext.preconditions, document: pin }
        if (admittedContext.storyboardTarget) admittedContext.storyboardTarget = { ...admittedContext.storyboardTarget, sourceDocumentRevision: pin.revision, sourceDocumentContentHash: pin.contentHash }
      },
      listModels: () => listModelSpecRows().filter(row => usableModels().some(model => model.entry.modelId === row.modelId && model.entry.vendor === row.vendor)),
      readCanvas: () => { const record = readProject(binding.projectId); if (!record || surface.registry.getCommittedProjectSelection() !== selection) throw new Error('project_binding_stale'); return projectCanvas(record).generationCanvas } })
    const designs = new Map<string, string | undefined>()
    for (const [documentId, entries] of Object.entries(projectCanvas(readProject(binding.projectId)!).storyboardDesignsByDocumentId ?? {})) for (const design of entries) designs.set(`${documentId}/${design.id}`, planHash(design.plan))
    const scoped = domain.map(tool => ({ ...tool, run: (input: unknown) => admissions.run({ surface, binding, signal, onApprovalWaiting, designs }, () => tool.run(input)) }))
    return { tools: scoped, context: admittedContext, dispose: () => undefined }
  }
  function restore() { installCatalogRowLookup(); for (const project of listProjects()) void runtime.restoreProject(project.id).catch(error => console.error('Production restore failed:', project.id, error instanceof Error ? error.message : String(error))) }
  return { runtime, forSurface, tools, restore }
}
