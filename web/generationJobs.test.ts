import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const mocks = vi.hoisted(() => ({ run: vi.fn(), query: vi.fn(), deliver: vi.fn(), waits: [] as Array<() => void> }))
vi.mock('node:timers/promises', () => ({ setTimeout: () => new Promise<void>(resolve => mocks.waits.push(resolve)) }))
vi.mock('../electron/comfyuiProgressSocket', () => ({ watchComfyuiTask: vi.fn().mockResolvedValue({ ok: true }), unwatchComfyuiTask: vi.fn() }))
vi.mock('../electron/runtime', () => ({ runTask: mocks.run, fetchTaskResult: mocks.query }))
vi.mock('../electron/spendGrant', () => ({ mintSpendGrant: () => 'local-grant' }))
vi.mock('../electron/catalog/catalogStore', () => ({ readCatalog: () => ({ vendors: [{ key: 'comfyui-local', authType: 'none' }] }) }))
vi.mock('../electron/projects/repository', () => ({ readProject: () => ({ payload: { generationCanvas: { nodes: [{ id: 'shot', kind: 'video' }] } } }) }))
vi.mock('./projectState', () => ({ deliverWebOutcome: mocks.deliver, markWebGenerationOwned: vi.fn().mockResolvedValue(undefined), projectCanvas: (record: { payload: unknown }) => record.payload }))
vi.mock('../src/workbench/generationCanvas/runner/catalogTaskResultParse', () => ({ normalizeCatalogTaskResult: () => ({ id: 'candidate', type: 'video', url: 'nomi-local://asset/project/assets/new.mp4', createdAt: 1 }) }))
import { WebGenerationJobs } from './generationJobs'
const receipt = { id: 'prompt-id', kind: 'text_to_video', status: 'queued', assets: [], raw: {} }
const completed = { ...receipt, status: 'succeeded', assets: [{ type: 'video', url: 'nomi-local://asset/project/assets/new.mp4' }] }
const payload = { vendor: 'comfyui-local', request: { kind: 'text_to_video', prompt: 'A real shot description', extras: { projectId: 'project', nodeId: 'shot', idempotencyKey: 'once', modelKey: 'local-video' } } }
beforeEach(() => { vi.clearAllMocks(); mocks.waits.length = 0; mocks.run.mockResolvedValue(receipt); mocks.query.mockResolvedValue({ vendor: 'comfyui-local', result: completed }); mocks.deliver.mockResolvedValue(undefined) })
const flush = async () => { mocks.waits.shift()?.(); for (let i = 0; i < 12; i++) await Promise.resolve() }
describe('durable local generation boundary', () => {
  it('collects the existing query envelope and returns the same renderer envelope', async () => {
    const jobs = new WebGenerationJobs(fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-web-jobs-')))
    await jobs.submit(payload)
    await flush()
    expect(mocks.deliver).toHaveBeenCalledWith('project', 'shot', expect.objectContaining({ kind: 'result' }))
    expect(jobs.result({ taskId: receipt.id, projectId: 'project' })).toMatchObject({ vendor: 'comfyui-local', result: { status: 'succeeded' } })
  })
  it('deduplicates submission and recovers a persisted receipt without resubmitting', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-web-jobs-'))
    const jobs = new WebGenerationJobs(root)
    await Promise.all([jobs.submit(payload), jobs.submit(payload)])
    expect(mocks.run).toHaveBeenCalledTimes(1)
    const restored = new WebGenerationJobs(root)
    restored.restore()
    expect(mocks.run).toHaveBeenCalledTimes(1)
    expect(restored.result({ taskId: receipt.id, projectId: 'project' })).toMatchObject({ vendor: 'comfyui-local', result: receipt })
    await expect(jobs.submit({ ...payload, request: { ...payload.request, extras: { ...payload.request.extras, idempotencyKey: 'another' } } })).rejects.toThrow('already has a generation')
  })
  it('rejects cancellation of another project before contacting the shared GPU', async () => {
    const jobs = new WebGenerationJobs(fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-web-jobs-')))
    await jobs.submit(payload)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await jobs.cancel(receipt.id, 'another-project')).toEqual({ ok: false, mode: 'failed' })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

})
