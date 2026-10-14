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
