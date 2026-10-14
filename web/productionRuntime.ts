import { createProductionRunRepository, type ProductionRunRepository } from '../electron/productionRun/productionRunRepository'
import { createProductionRunService } from '../electron/productionRun/productionRunService'
import { registerProductionRunService } from '../electron/productionRun/productionRunServiceRegistry'
import { createProductionGenerationOperationStore } from '../electron/productionRun/productionGenerationOperationStore'
import { createProductionGenerationSubmission } from '../electron/productionRun/productionGenerationSubmission'
import { createMultiShotBatchScheduler } from '../electron/productionRun/multiShotBatchScheduler'
import { createProductionShotDispatchGuard } from '../electron/productionRun/productionShotDispatchGuard'
import { createCanvasLandingHost } from '../electron/productionRun/canvasLandingHost'
import { createRunObservationDrivers } from '../electron/capabilityCore/appIntegrationRunObservation'
import { patchStoryboardAuthoring } from '../electron/capabilityCore/mcpGenerationMultiShot'
import type { PlanCandidate } from '../electron/capabilityCore/executionContract'
import { createGenerationPlanningHandler } from '../electron/capabilityCore/mcpGenerationTools'
import { createRunOwnedGenerationGateAuthority } from '../electron/capabilityCore/runOwnedGenerationGateAuthority'
import { createLiveGenerationRuntime } from '../electron/capabilityCore/liveGenerationRuntime'
import { createPiGenerationTransportAdapter } from '../electron/capabilityCore/generationTransportAdapters'
import { createPendingSpendActions } from '../electron/capabilityCore/appIntegrationSpendConfirm'
import { createProductionProjectSessionRuntime } from '../electron/capabilityCore/projectSessionRuntime'
import { createMcpConnectionContext } from '../electron/capabilityCore/mcpConnectionContext'
import { getApprovalReceiptAuthority, currentProjectRevision } from '../electron/capabilityCore/approvalReceiptRuntime'
import { ensureToken, signMcpClient, ensureCapabilitySigningKey } from '../electron/capabilityCore/security'
import { prepareProductionGenerationAuthorizationWithReferences } from '../electron/productionRun/prepareProductionGenerationAuthorization'
import { readWorkspaceProject, resolveWorkspaceProjectDir } from '../electron/workspace/workspaceRepository'
import { getWorkspaceRepositoryDeps } from '../electron/runtimePaths'
import { readCatalog } from '../electron/catalog/catalogStore'
import { createCatalogModelPricingResolver, createCatalogShotPriceResolver } from '../electron/productionRun/catalogPricingResolver'
import { deriveUsableVideoModelCandidates } from '../electron/capabilityCore/usableVideoModelCandidates'
import { readGenerationDefaultModelResolver } from '../electron/capabilityCore/generationDefaultModelResolver'
import { resolvePlanPatch } from '../electron/capabilityCore/generationPlanPatch'
import { unknownSubmissionShotLabels } from '../electron/shared/productionShotPhase'
import { resolveProductionReferenceUrls } from '../electron/capabilityCore/productionReferenceUrls'
import { projectSpendReferenceAssets, resolveIndexedReferencePreview } from '../electron/capabilityCore/pendingSpendReferences'
import { resolveProjectAssetReferenceIdentity } from '../electron/assets/projectAssetStore'
import { registerBatchSchedulerKicker } from '../electron/productionRun/batchSchedulerKick'
import { readAgentApprovalPolicy } from '../electron/settings/agentApprovalPolicySettings'
import type { CurrentProjectSelection } from '../electron/capabilityCore/currentProjectResolver'
import type { ProjectBinding } from '../electron/shared/projectBinding'
import { sameProjectAgentBinding } from '../electron/shared/projectBinding'
import type { ProductionRun } from '../electron/productionRun/productionRunTypes'
import { assertDocumentWritePreconditions } from '../src/workbench/creation/documentWriteTarget'
import { documentSessionState } from '../src/workbench/project/documentSessionCore'
import { projectCanvas } from './projectState'
import { createWebComfyuiProviderBootstrap, materializeComfyuiProductionOutput } from './comfyuiProductionProvider'

export type WebGestureTarget = Readonly<{ surfaceId: string; clientSessionId: string; origin: string }>
export type WebProductionRuntimeDependencies = {
  requestRenderer: (op: string, payload: unknown, timeoutMs: number) => Promise<unknown>;
  assertDocumentOperation?: (projectId: string, operationId: string) => void;
  isProjectOpen: (projectId: string) => boolean;
  onRunChanged?: (run: ProductionRun) => void;
}

/** All host-specific choices live here; the Run/receipt/outbox/scheduler remain original owners. */
export function createWebProductionRuntime(deps: WebProductionRuntimeDependencies) {
  const projectRoot = (projectId: string) => resolveWorkspaceProjectDir(projectId, getWorkspaceRepositoryDeps())
  const receipts = getApprovalReceiptAuthority()
  const baseRepository = createProductionRunRepository({ semanticGenerationStages: 'candidates-only' })
  let followChange: (run: ProductionRun) => void = () => undefined
  const service = createProductionRunService({ repository: baseRepository, requestRenderer: deps.requestRenderer,
    approvalReceiptAuthority: receipts, projectRevisionResolver: currentProjectRevision, projectRootResolver: projectRoot,
    onEvents: (_events, run) => { followChange(run); deps.onRunChanged?.(run) } })
  registerProductionRunService(service)
  const repository = service.repository
  const landing = createCanvasLandingHost({ readRun: repository.read, command: (projectId, runId, command) => service.command(projectId, runId, command as never),
    requestRenderer: deps.requestRenderer, resolveProjectRoot: projectRoot, isProjectOpen: deps.isProjectOpen })
  followChange = landing.followRunChange
  const store = createProductionGenerationOperationStore(service, { onPlanChanged: landing.landDraftOnCanvas })
  const syncDocumentPatch = async (projectId: string, operationId: string, patch: Record<string, unknown>, shotId?: string, expectedRevision?: number) => {
    const run = repository.read(projectId, operationId), source = run?.origin.sourceDocument
    if (!source || !run?.generationPlan) return
    if (expectedRevision !== undefined && run.revision !== expectedRevision) throw new Error('storyboard_content_conflict')
    assertSource(projectId, operationId)
    await patchStoryboardAuthoring({ sourceDocumentId: source.documentId }, { shotId: shotId ?? run.generationPlan.candidate.candidateId, patch }, projectId, operationId,
      (_id, value) => value as PlanCandidate['references'], resolveIndexedReferencePreview, deps.requestRenderer)
  }
  const operations: typeof store = { ...store,
    patch: async (projectId, operationId, patch, now, shotId, target) => {
      await syncDocumentPatch(projectId, operationId, patch as Record<string, unknown>, shotId)
      return store.patch(projectId, operationId, patch, now, shotId, target)
    },
    revise: async (projectId, operationId, input, now) => {
      await syncDocumentPatch(projectId, operationId, input.patch, input.shotId, input.expectedRevision)
      return store.revise!(projectId, operationId, input, now)
    },
  }
  const unboundProviders = () => createWebComfyuiProviderBootstrap({ projectId: '', runId: '', readRun: () => null })
  const live = createLiveGenerationRuntime({ bootstrap: () => unboundProviders() })
  const resolvePricing = (providerId: string, modelId: string) => createCatalogModelPricingResolver(readCatalog().models)(providerId, modelId)
  const resolveShotPrice = (contract: Parameters<ReturnType<typeof createCatalogShotPriceResolver>>[0]) => createCatalogShotPriceResolver(readCatalog().models)(contract)
  const beforeDispatch = createProductionShotDispatchGuard({ readRun: (projectId, runId) => repository.read(projectId, runId) ?? undefined })
  const buildSubmission = (projectId: string, runId: string) => {
    const record = readWorkspaceProject(projectId, getWorkspaceRepositoryDeps()), root = projectRoot(projectId)
    if (!record?.immutableProjectUuid || !record.projectGeneration || !root) throw new Error('Production project identity is unavailable')
    const bootstrap = createWebComfyuiProviderBootstrap({ projectId, runId, readRun: () => repository.read(projectId, runId) })
    return createProductionGenerationSubmission({ repository, projectRoot: root, immutableProjectUuid: record.immutableProjectUuid, projectGeneration: record.projectGeneration,
      intentMacKey: ensureCapabilitySigningKey('generation-intent'), providers: bootstrap.providers, beforeDispatch,
      materializeOutput: async ({ projectId: id, providerTaskId, output }) => materializeComfyuiProductionOutput(id, providerTaskId, output) })
  }
  const completeCandidates = (projectId: string, runId: string) => settleWebProductionCandidates(repository, projectId, runId)
  const observation = createRunObservationDrivers({ repository, buildSchedulerForRun: (projectId, runId) =>
    createMultiShotBatchScheduler({ repository, submission: buildSubmission(projectId, runId), projectId, runId, onBatchComplete: () => { completeCandidates(projectId, runId) } }) })
  registerBatchSchedulerKicker(observation.kickSchedulerForRun)
  const assertSource = (projectId: string, runId: string) => {
    const source = repository.read(projectId, runId)?.origin.sourceDocument
    if (!source) return
    const record = readWorkspaceProject(projectId, getWorkspaceRepositoryDeps())
    const document = record && projectCanvas(record).workbenchDocuments?.find(value => value.id === source.documentId)
    if (!document) throw new Error("storyboard_source_unavailable")
    assertDocumentWritePreconditions({ revision: source.revision, contentHash: source.contentHash }, documentSessionState(document))
    deps.assertDocumentOperation?.(projectId, runId)
  }
  const planning = createGenerationPlanningHandler({ registry: live.registry, operations, requestRenderer: deps.requestRenderer, documentGenerationOwner: "production-run", assertDocumentOperation: assertSource,
    resolveStoryboardReferenceUrl: resolveIndexedReferencePreview, resolveAssetReferenceIdentity: resolveProjectAssetReferenceIdentity,
    get videoModelCandidates() { return deriveUsableVideoModelCandidates() },
    defaultModelForTaskKind: taskKind => readGenerationDefaultModelResolver()(taskKind), resolveModelPricing: resolvePricing,
    unknownShotsOf: (operation, lease) => unknownSubmissionShotLabels(repository.read(lease.projectId, operation.operationId)),
    providerReadiness: ({ providerId }) => unboundProviders().readinessByProvider[providerId] ?? { providerReady: false, missingForSubmit: ['configured_provider'] },
    prepareAuthorization: async ({ lease, operation, contract, multiShot }) => {
      assertSource(lease.projectId, operation.operationId)
      await landing.settleCanvasLanding(lease.projectId)
      const record = readWorkspaceProject(lease.projectId, getWorkspaceRepositoryDeps()), run = repository.read(lease.projectId, operation.operationId)
      if (!record || !run) throw new Error('Current production authorization snapshot is unavailable')
      return prepareProductionGenerationAuthorizationWithReferences({ lease, projectRevision: record.revision, operation, contract, ...(multiShot ? { multiShot } : {}),
        providers: unboundProviders().providers, resolveShotPrice, run, now: new Date().toISOString(),
        assertCurrent: () => {
          assertSource(lease.projectId, operation.operationId)
          const current = readWorkspaceProject(lease.projectId, getWorkspaceRepositoryDeps()), currentRun = repository.read(lease.projectId, operation.operationId)
          if (!current || !current.immutableProjectUuid || typeof current.projectGeneration !== 'number' || !sameProjectAgentBinding({ projectId: current.id, immutableProjectUuid: current.immutableProjectUuid, projectGeneration: current.projectGeneration }, lease) || current.revision !== record.revision || currentRun?.revision !== run.revision) throw new Error('generation_reference_scope_changed')
        } }, referenceInput => resolveProductionReferenceUrls(referenceInput, { assets: projectSpendReferenceAssets, localize: async (_providerId, urls) => urls }))
    },
    start: async (operation, lease) => {
      const submission = buildSubmission(lease.projectId, operation.operationId)
      if (operation.shots?.length) {
        await landing.landCanvasBestEffort(lease.projectId, operation.operationId)
        const run = service.readFull(lease.projectId, operation.operationId)
        if (run.generationPlan?.state === 'sealed') await service.command(lease.projectId, operation.operationId, {
          commandId: `generation.submit:${operation.operationId}:v${run.planVersion}`, expectedRevision: run.revision, type: 'generation.submit', payload: {}, issuedAt: new Date().toISOString() })
        observation.kickSchedulerForRun(lease.projectId, operation.operationId)
        return { operationId: operation.operationId, nextAction: 'observe' }
      }
      const started = await submission.start({ projectId: lease.projectId, operationId: operation.operationId })
      observation.settleSingleShotRunning(lease.projectId, operation.operationId)
      await landing.landCanvasBestEffort(lease.projectId, operation.operationId)
      observation.observeSingleShotRun(submission, lease.projectId, operation.operationId)
      return started
    } })
  const gates = createRunOwnedGenerationGateAuthority({ owner: service, operations, planning, receipts })

  const forSurface = (binding: ProjectBinding, input: {
    getCommittedSelection: () => CurrentProjectSelection | null;
    getGestureTarget: () => WebGestureTarget | null;
  }) => {
    const committedSelection = input.getCommittedSelection()
    if (!committedSelection || !sameProjectAgentBinding(binding, committedSelection)) throw new Error('project_binding_stale')
    ensureToken()
    const proof = signMcpClient('nomi-web')
    if (!proof) throw new Error('Web production transport is unavailable')
    const connection = createMcpConnectionContext({ client: 'nomi-web', proof })
    const session = createProductionProjectSessionRuntime({ getOpenProjectSelection: input.getCommittedSelection, isServerAllowlisted: () => false })
    const isCurrentBinding = () => { const current = input.getCommittedSelection(); return Boolean(current === committedSelection && current && sameProjectAgentBinding(binding, current)) }
    const leaseFor = async (requested: ProjectBinding) => {
      if (!sameProjectAgentBinding(binding, requested) || !isCurrentBinding()) throw new Error('project_binding_stale')
      const opened = await session.authority.open({ bootstrap: { mode: 'current_project' } }, connection)
      const lease = await session.authority.verifyLease(opened.leaseHandle, { connection, projectHint: binding.projectId })
      if (!sameProjectAgentBinding(binding, lease)) throw new Error('project_binding_stale')
      return lease
    }
    const transport = createPiGenerationTransportAdapter(binding, { planning, ...gates, approvalReceiptAuthority: receipts, leaseFor, approvalPolicy: readAgentApprovalPolicy })
    const pendingSpend = createPendingSpendActions({ isProjectOpen: id => id === binding.projectId && isCurrentBinding(),
      runs: repository, operations, planning, ...gates, receipts, rendererTarget: () => null, webGestureTarget: input.getGestureTarget,
      committedBinding: input.getCommittedSelection, leaseFor, resolvePricing,
      normalizePatch: (baseCandidate, userPatch) => resolvePlanPatch({ baseCandidate, userPatch, registry: live.registry, videoModelCandidates: deriveUsableVideoModelCandidates() }).normalizedPatch })
    return { transport, pendingSpend, leaseFor, planning, readTask: async (operationId: string) => { await leaseFor(binding); return service.readProjection(binding.projectId, operationId) } }
  }
  const restoreProject = async (projectId: string) => {
    for (const summary of repository.list(projectId)) {
      const run = repository.read(projectId, summary.runId)
      if (!run || ['completed', 'cancelled'].includes(run.status)) continue
      await landing.reconcileExistingCanvas(projectId, run.runId)
      if (run.generationPlan?.shots?.length) observation.kickSchedulerForRun(projectId, run.runId)
      else if (run.jobs.some(job => Boolean(job.providerTaskId) && ['provider_accepted', 'polling'].includes(job.status))) observation.observeSingleShotRun(buildSubmission(projectId, run.runId), projectId, run.runId)
    }
  }
  return { service, repository, planning, operations, forSurface, restoreProject, dispose: () => { observation.stop(); registerBatchSchedulerKicker(null) } }
}

/** Candidate-only completion refuses unfinished jobs and does not stamp QA/assembly/export. */
export function settleWebProductionCandidates(repository: Pick<ProductionRunRepository, 'read' | 'execute'>, projectId: string, runId: string): boolean {
  let run = repository.read(projectId, runId)
  if (!run || run.status !== 'running' || run.stages.some(stage => stage.stageId !== 'generate')) return false
  const shots = run.generationPlan?.shots?.filter(shot => shot.included !== false)
  if (!shots?.length || !shots.every(shot => run!.jobs.some(job => job.metadata?.shotId === shot.shotId && ['ready', 'adopted'].includes(job.status)
    && run!.artifacts.some(artifact => artifact.jobId === job.jobId && ['ready', 'adopted'].includes(artifact.status) && artifact.contentHash && artifact.projectRelativePath)))) return false
  if (run.jobs.some(job => !['ready', 'adopted', 'detached', 'cancelled_remote', 'too_late'].includes(job.status))) return false
  const stage = run.stages.find(row => row.stageId === 'generate')
  if (stage && stage.status !== 'completed') run = repository.execute(projectId, runId, { commandId: `web-candidates:${runId}:stage:${run.revision}`, expectedRevision: run.revision,
    type: 'stage.upsert', payload: { stage: { ...stage, status: 'completed', completedAt: new Date().toISOString() } }, issuedAt: new Date().toISOString() }).run
  repository.execute(projectId, runId, { commandId: `web-candidates:${runId}:complete:${run.revision}`, expectedRevision: run.revision, type: 'run.status', payload: { status: 'completed' }, issuedAt: new Date().toISOString() })
  return true
}
