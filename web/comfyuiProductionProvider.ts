import { comfyInputNameFromViewUrl } from '../electron/catalog/comfyuiLocal'
import { rewriteVendorUrl } from '../electron/vendor/vendorBaseFallback'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runTask, fetchTaskResult, type TaskRequest, type TaskResult } from '../electron/runtime'
import { readCatalog } from '../electron/catalog/catalogStore'
import { isComfyuiVendor } from '../electron/catalog/types'
import { modelHasPublishedExecution } from '../electron/shared/modelPublication'
import { mintSpendGrant } from '../electron/spendGrant'
import { authorizationGateForJob } from '../electron/shared/productionSpendAuthority'
import { productionGenerationPayloadHash } from '../electron/productionRun/productionGenerationAuthorization'
import type { ProductionRun } from '../electron/productionRun/productionRunTypes'
import type { GenerationProvider, GenerationProviderRequestInputV1, GenerationProviderOutput } from '../electron/capabilityCore/generationRuntimeAdapter'
import type { GenerationProviderBootstrap } from '../electron/capabilityCore/generationProviderBootstrap'
import type { GenerationOutputMaterializationReceipt } from '../electron/capabilityCore/generationOutputMaterializer'
import { absolutePathFromLocalAssetUrl } from '../electron/assets/localAssetFile'
import { writeDeterministicAsset, contentTypeFromStoredFile } from '../electron/assets/projectAssetStore'
import { spendReferenceKey } from '../electron/shared/contracts/pendingSpendConfirm'

export type ComfyuiProductionProviderDependencies = {
  projectId: string; runId: string;
  readRun: () => ProductionRun | null;
  runTask?: typeof runTask; fetchTaskResult?: typeof fetchTaskResult;
  mintGrant?: typeof mintSpendGrant;
}

/** Frozen semantic request; transient authorization grant is deliberately absent. */
function requestFor(input: GenerationProviderRequestInputV1, providerId: string): TaskRequest {
  if (!['text_to_video', 'image_to_video', 'text_to_image', 'image_edit'].includes(input.mode)) throw new Error('Unsupported ComfyUI production mode')
  const extras: Record<string, unknown> = { ...structuredClone(input.parameters), modelKey: input.modelId,
    ...(input.modeId ? { modeId: input.modeId } : {}), idempotencyKey: input.idempotencyKey }
  for (const reference of input.references) {
    const snapshotUrl = input.referenceUrls?.[spendReferenceKey(reference)]
    if (!snapshotUrl) throw new Error('Approved reference URL is unavailable')
    const vendor = readCatalog().vendors.find(row => row.key === providerId)
    if (!vendor?.baseUrlHint) throw new Error('generation_reference_provider_unavailable')
    const url = comfyInputNameFromViewUrl(rewriteVendorUrl(vendor.baseUrlHint), snapshotUrl)
    // These standard reference names are consumed by the original ComfyUI media boundary.
    const key = reference.role === 'first_frame' ? 'firstFrameUrl' : reference.role === 'last_frame' ? 'lastFrameUrl'
      : reference.kind === 'video' ? 'sourceVideoUrl' : reference.kind === 'audio' ? 'sourceAudioUrl' : 'referenceImages'
    if (key === 'referenceImages') extras[key] = [...(Array.isArray(extras[key]) ? extras[key] as unknown[] : []), url]
    else { if (extras[key] && extras[key] !== url) throw new Error('Approved reference conflicts with parameters'); extras[key] = url }
  }
  return { kind: input.mode as TaskRequest['kind'], prompt: input.prompt, extras }
}

/** Only the canonical submission outbox can reach a grant-producing dispatch. */
export function createComfyuiProductionProvider(providerId: string, deps: ComfyuiProductionProviderDependencies): GenerationProvider {
  const submit = async (request: unknown, idempotencyKey: string) => {
    const run = deps.readRun()
    if (!run || run.projectId !== deps.projectId || run.runId !== deps.runId) throw new Error('Production Run binding is unavailable')
    const job = run.jobs.find(row => row.provider === providerId && row.providerIdempotencyKey === idempotencyKey)
    if (!job || !['submit_intent_persisted', 'submitting'].includes(job.status)) throw new Error('Canonical dispatch intent is required')
    const gate = authorizationGateForJob(run, job)
    const approved = gate?.authorizationEnvelope.jobs.find(row => row.jobId === job.jobId)
    if (gate?.status !== 'approved' || !approved || approved.providerWirePayloadHash !== productionGenerationPayloadHash(request)) throw new Error('Approved dispatch payload does not match')
    const nodeId = job.nodeId || job.jobId
    const grantId = (deps.mintGrant ?? mintSpendGrant)({ nodeIds: [nodeId], maxAttemptsPerNode: 1 })
    const wire = request as TaskRequest
    const result = await (deps.runTask ?? runTask)({ vendor: providerId, request: { ...wire, extras: { ...wire.extras, projectId: deps.projectId, nodeId, grantId, executionBinding: job.executionBinding } } })
    if (!result.id) throw new Error('ComfyUI returned no provider task receipt')
    return { providerTaskId: result.id, raw: result }
  }
  const query = async (providerTaskId: string) => {
    const run = deps.readRun()
    const job = run?.jobs.find(row => row.provider === providerId && row.providerTaskId === providerTaskId)
    if (!run || !job) throw new Error('Provider task does not belong to this Run')
    const contract = job.metadata?.shotId ? run.generationPlan?.shots?.find(shot => shot.shotId === job.metadata?.shotId)?.contract : run.generationPlan?.contract
    const result = (await (deps.fetchTaskResult ?? fetchTaskResult)({ taskId: providerTaskId, vendor: providerId, projectId: deps.projectId, nodeId: job.nodeId || job.jobId, taskKind: job.taskKind || contract?.mode, modelKey: job.model, prompt: contract?.prompt || '' })).result
    return { status: result.status, raw: result }
  }
  return {
    providerId, capabilities: { submitIdempotency: false, query: true, reconcile: true, cancel: false, materialize: true },
    buildRequest: input => requestFor(input, providerId), submit, query,
    reconcile: async ({ providerTaskId }) => providerTaskId
      ? { disposition: 'found', providerTaskId, raw: await query(providerTaskId) }
      : { disposition: 'indeterminate' },
    materialize: async ({ raw }) => {
      const result = raw as TaskResult | undefined
      if (result?.status !== 'succeeded' || !Array.isArray(result.assets) || !result.assets.length) throw new Error('ComfyUI outputs are not ready')
      return { outputs: result.assets.map(asset => ({ kind: asset.type, url: asset.url, ...(asset.assetId ? { providerOutputId: asset.assetId } : {}), ...(asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}) })), raw }
    },
  }
}

/** Keyless local services are executable connections, not missing API keys. */
export function createWebComfyuiProviderBootstrap(deps: ComfyuiProductionProviderDependencies): GenerationProviderBootstrap {
  const state = readCatalog()
  const providers = state.vendors.filter(vendor => vendor.enabled && isComfyuiVendor(vendor) && vendor.authType === 'none'
    && state.models.some(model => model.vendorKey === vendor.key && model.enabled && modelHasPublishedExecution(model, { mappings: state.mappings })))
    .map(vendor => createComfyuiProductionProvider(vendor.key, deps))
  return { providers, readinessByProvider: Object.fromEntries(state.vendors.map(vendor => {
    const provider = providers.find(row => row.providerId === vendor.key)
    return [vendor.key, provider ? { providerReady: true, capabilities: provider.capabilities }
      : { providerReady: false, capabilities: { submitIdempotency: false, query: false, reconcile: false, cancel: false }, missingForSubmit: ['configured_provider'] }]
  })) }
}

/** Runtime already localized the output; reuse the asset store instead of downloading a local URL. */
export function materializeComfyuiProductionOutput(projectId: string, providerTaskId: string, output: GenerationProviderOutput): GenerationOutputMaterializationReceipt {
  const absolutePath = absolutePathFromLocalAssetUrl(output.url, projectId)
  if (!absolutePath) throw new Error('ComfyUI production output must belong to this project')
  const bytes = fs.readFileSync(absolutePath)
  const storedValue = writeDeterministicAsset(projectId, bytes, path.basename(absolutePath), contentTypeFromStoredFile(absolutePath),
    { kind: 'generated', source: 'external-mcp', providerTaskId }, `${providerTaskId}:${output.providerOutputId || output.url}`)
  if (!storedValue || typeof storedValue !== 'object') throw new Error('Asset store returned no local receipt')
  const stored = storedValue as { id?: string; data?: { relativePath?: string; width?: number; height?: number; thumbnailRelativePath?: string } }
  if (!stored.id || !stored.data?.relativePath) throw new Error('Asset store returned an incomplete local receipt')
  return { artifactId: stored.id, kind: output.kind, contentHash: createHash('sha256').update(bytes).digest('hex'), projectRelativePath: stored.data.relativePath,
    ...(typeof stored.data.width === 'number' ? { width: stored.data.width } : {}), ...(typeof stored.data.height === 'number' ? { height: stored.data.height } : {}),
    ...(stored.data.thumbnailRelativePath ? { thumbnailRelativePath: stored.data.thumbnailRelativePath } : {}) }
}
