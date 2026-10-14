import { spendReferenceKey } from '../electron/shared/contracts/pendingSpendConfirm'
import * as catalogStore from '../electron/catalog/catalogStore'
import { taskTemplateParams } from '../electron/catalog/taskParams'
import { describe, it, expect, vi } from 'vitest'
import { createComfyuiProductionProvider } from './comfyuiProductionProvider'
import { productionGenerationPayloadHash } from '../electron/productionRun/productionGenerationAuthorization'
import type { ProductionRun } from '../electron/productionRun/productionRunTypes'
import type { GenerationProviderRequestInputV1 } from '../electron/capabilityCore/generationRuntimeAdapter'

const input: GenerationProviderRequestInputV1 = { moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'real-model', mode: 'text_to_image', prompt: 'A fox', parameters: { seed: 42 }, references: [], contractHash: 'a'.repeat(64), idempotencyKey: 'provider-idem' }
function fixture(request: unknown): ProductionRun {
  return { projectId: 'project', runId: 'run', jobs: [{ jobId: 'job', provider: 'comfyui:test', providerIdempotencyKey: 'provider-idem', authorizationDigest: 'digest', status: 'submitting', nodeId: 'node', model: 'real-model', taskKind: 'text_to_image' }],
    gates: [{ gateId: 'gate', scope: 'budget_envelope', authorizationDigest: 'digest', status: 'approved', authorizationEnvelope: { jobs: [{ jobId: 'job', providerWirePayloadHash: productionGenerationPayloadHash(request) }] } }] } as unknown as ProductionRun
}
describe('ComfyUI canonical production provider', () => {
  it('cannot mint a grant without the durable approved dispatch and identical wire payload', async () => {
    const mintGrant = vi.fn(() => 'grant'), runTask = vi.fn()
    let run: ProductionRun | null = null
    const provider = createComfyuiProductionProvider('comfyui:test', { projectId: 'project', runId: 'run', readRun: () => run, mintGrant, runTask })
    const request = provider.buildRequest(input)
    await expect(provider.submit(request, input.idempotencyKey)).rejects.toThrow('binding')
    run = fixture(request); run.gates[0].status = 'waiting'
    await expect(provider.submit(request, input.idempotencyKey)).rejects.toThrow('Approved')
    run.gates[0].status = 'approved'; run.jobs[0].status = 'authorized'
    await expect(provider.submit(request, input.idempotencyKey)).rejects.toThrow('intent')
    run.jobs[0].status = 'submitting'
    await expect(provider.submit({ ...request as object, prompt: 'changed' }, input.idempotencyKey)).rejects.toThrow('payload')
    expect(mintGrant).not.toHaveBeenCalled(); expect(runTask).not.toHaveBeenCalled()
  })
  it('lowers an approved outbox job into one runtime attempt and preserves provider receipt', async () => {
    const mintGrant = vi.fn(() => 'grant'), runTask = vi.fn(async () => ({ id: 'real-prompt-id', kind: 'text_to_image' as const, status: 'queued' as const, assets: [], raw: {} }))
    let run: ProductionRun | null = null
    const provider = createComfyuiProductionProvider('comfyui:test', { projectId: 'project', runId: 'run', readRun: () => run, mintGrant, runTask })
    const request = provider.buildRequest(input); run = fixture(request)
    expect(await provider.submit(request, input.idempotencyKey)).toMatchObject({ providerTaskId: 'real-prompt-id' })
    expect(mintGrant).toHaveBeenCalledExactlyOnceWith({ nodeIds: ['node'], maxAttemptsPerNode: 1 })
    expect(runTask.mock.calls[0][0]).toMatchObject({ vendor: 'comfyui:test', request: { prompt: 'A fox', extras: { projectId: 'project', nodeId: 'node', modelKey: 'real-model', grantId: 'grant' } } })
    run.jobs[0].status = 'provider_accepted'; run.jobs[0].providerTaskId = 'real-prompt-id'
    await expect(provider.submit(request, input.idempotencyKey)).rejects.toThrow('intent')
    expect(mintGrant).toHaveBeenCalledTimes(1); expect(runTask).toHaveBeenCalledTimes(1)
    expect(provider.capabilities).toMatchObject({ submitIdempotency: false, query: true, cancel: false })
    expect(await provider.reconcile!({ idempotencyKey: input.idempotencyKey })).toEqual({ disposition: 'indeterminate' })
  })
  it('queries using durable job metadata after the provider instance is recreated', async () => {
    const fetchTaskResult = vi.fn(async () => ({ vendor: 'comfyui:test', result: { id: 'receipt', kind: 'text_to_image' as const, status: 'succeeded' as const, assets: [], raw: {} } }))
    const run = fixture({}); run.jobs[0].providerTaskId = 'receipt'
    const provider = createComfyuiProductionProvider('comfyui:test', { projectId: 'project', runId: 'run', readRun: () => run, fetchTaskResult })
    await provider.query!('receipt')
    expect(fetchTaskResult).toHaveBeenCalledWith(expect.objectContaining({ modelKey: 'real-model', taskKind: 'text_to_image', projectId: 'project', nodeId: 'node' }))
    await expect(provider.query!('foreign')).rejects.toThrow('belong')
    expect(fetchTaskResult).toHaveBeenCalledTimes(1)
  })
})

describe('approved Comfy uploaded input snapshots', () => {
  const base = 'http://127.0.0.1:19189/comfy'
  function provider() {
    vi.spyOn(catalogStore, 'readCatalog').mockReturnValue({ vendors: [{ key: 'comfyui:test', baseUrlHint: base }] } as ReturnType<typeof catalogStore.readCatalog>)
    return createComfyuiProductionProvider('comfyui:test', { projectId: 'project', runId: 'run', readRun: () => null })
  }
  function frameInput(url: string): GenerationProviderRequestInputV1 {
    const references = [{ assetId: 'image', contentHash: 'b'.repeat(64), version: 1, kind: 'image', role: 'first_frame' }, { assetId: 'image', contentHash: 'b'.repeat(64), version: 1, kind: 'image', role: 'last_frame' }] as GenerationProviderRequestInputV1['references']
    return { ...input, mode: 'image_to_video', references, referenceUrls: Object.fromEntries(references.map(reference => [spendReferenceKey(reference), url])) }
  }
  it('renders both LoadImage slots as uploaded input names, while retaining the sealed snapshot outside the wire', () => {
    const value = frameInput(base + '/view?filename=sealed.png&subfolder=nomi%2Fapproved&type=input')
    const request = provider().buildRequest(value) as { extras: Record<string, unknown> }
    expect(taskTemplateParams(request)).toMatchObject({ first_frame_url: 'nomi/approved/sealed.png', last_frame_url: 'nomi/approved/sealed.png' })
    expect(value.referenceUrls?.[spendReferenceKey(value.references[0])]).toContain('/view?')
  })
  it('lowers generic image references through the same input receipt boundary', () => {
    const reference = { assetId: 'image', contentHash: 'b'.repeat(64), version: 1, kind: 'image' as const }
    const request = provider().buildRequest({ ...input, mode: 'image_edit', references: [reference], referenceUrls: { [spendReferenceKey(reference)]: base + '/view?filename=image..png&type=input' } }) as { extras: Record<string, unknown> }
    expect(taskTemplateParams(request).reference_images).toEqual(['image..png'])
  })
  it.each([
    'http://foreign.test/comfy/view?filename=x.png&type=input',
    base + '/view?filename=x.png&type=output',
    base + '/view?filename=..%2Fx.png&type=input',
    base + '/view?filename=x.png&subfolder=..%2Fx&type=input',
    base + '/view?filename=x.png&filename=y.png&type=input',
  ])('rejects a snapshot outside the provider input receipt: %s', url => {
    expect(() => provider().buildRequest(frameInput(url))).toThrow('generation_reference_comfy_input_invalid')
  })
})
