import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { writeJsonFileAtomic } from '../electron/jsonFile'
import { runTask, fetchTaskResult, type TaskResult } from '../electron/runtime'
import { mintSpendGrant } from '../electron/spendGrant'
import { readCatalog } from '../electron/catalog/catalogStore'
import { isComfyuiVendor } from '../electron/catalog/types'
import { readProject } from '../electron/projects/repository'
import { normalizeCatalogTaskResult } from '../src/workbench/generationCanvas/runner/catalogTaskResultParse'
import { deliverWebOutcome, projectCanvas, markWebGenerationOwned } from './projectState'
import { comfyuiEndpoint, comfyuiJobCancelEndpoint } from '../electron/comfyui/endpointResolver'
import { watchComfyuiTask, unwatchComfyuiTask, type ComfyuiProgressEvent } from '../electron/comfyuiProgressSocket'
import { hostEvents } from './runtimeHost'

const inputSchema = z.object({ vendor: z.string().min(1), request: z.object({ kind: z.enum(['text_to_video', 'image_to_video', 'text_to_image', 'image_edit']), prompt: z.string(), extras: z.record(z.unknown()) }).passthrough() }).strict()
type GenerationJob = { key: string; projectId: string; nodeId: string; payload: z.infer<typeof inputSchema>; receipt?: TaskResult; result?: TaskResult; error?: string; isSubmissionUnknown?: boolean; createdAt: number }

export class WebGenerationJobs {
  private readonly jobs = new Map<string, GenerationJob>()
  private readonly inFlight = new Map<string, Promise<TaskResult>>()
  private readonly byTask = new Map<string, GenerationJob>()
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 })
    hostEvents.on('message', (message: { channel: string; payload: ComfyuiProgressEvent }) => {
      if (message.channel !== 'nomi:tasks:comfyui:progress') return
      const event = message.payload
      const job = this.byTask.get(event.promptId)
      if (!job || job.result || job.error || event.kind === 'preview' || event.kind === 'done') return
      void deliverWebOutcome(job.projectId, job.nodeId, { kind: 'progress', progress: { taskId: event.promptId, taskKind: job.payload.request.kind.includes('video') ? 'video' : 'image', phase: event.kind === 'queue' ? 'queued' : 'running', percent: event.percent } }).catch(error => console.error('Progress persistence failed:', error))
    })
  }
  private watch(job: GenerationJob) {
    if (job.receipt) void watchComfyuiTask({ promptId: job.receipt.id, nodeId: job.nodeId, projectId: job.projectId, taskKind: job.payload.request.kind, modelKey: job.payload.request.extras.modelKey, vendorKey: job.payload.vendor }, 0).catch(error => console.error('ComfyUI progress unavailable:', error))
  }
  private store(job: GenerationJob) {
    writeJsonFileAtomic(path.join(this.root, `${job.key}.json`), job)
    this.jobs.set(job.key, job)
    if (job.receipt) this.byTask.set(job.receipt.id, job)
  }
  restore() {
    for (const name of fs.readdirSync(this.root).filter(name => /^[a-f0-9]{64}\.json$/.test(name))) {
      const job = JSON.parse(fs.readFileSync(path.join(this.root, name), 'utf8')) as GenerationJob
      this.jobs.set(job.key, job)
      if (job.receipt) this.byTask.set(job.receipt.id, job)
      if (!job.receipt && !job.result && !job.error) {
        job.isSubmissionUnknown = true; job.error = 'Submission interrupted before receipt; inspect ComfyUI before generating again'; this.store(job)
        void deliverWebOutcome(job.projectId, job.nodeId, { kind: 'status', status: 'error', error: job.error })
      } else if (job.receipt && !job.result && !job.error) { this.watch(job); void this.collect(job).catch(error => this.fail(job, error)) }
    }
  }
  async submit(raw: unknown): Promise<TaskResult> {
    const payload = inputSchema.parse(raw)
    const { projectId, nodeId, idempotencyKey, modelKey } = payload.request.extras
    if (typeof projectId !== 'string' || typeof nodeId !== 'string' || typeof idempotencyKey !== 'string' || !idempotencyKey || typeof modelKey !== 'string') throw new Error('Generation requires a persisted project, node and idempotency key')
    const vendor = readCatalog().vendors.find(vendor => vendor.key === payload.vendor)
    if (!vendor || !isComfyuiVendor(vendor) || vendor.authType !== 'none') throw new Error('Nomi Web manual generation supports local ComfyUI only')
    const key = createHash('sha256').update(`${projectId}:${nodeId}:${idempotencyKey}`).digest('hex')
    const existing = this.jobs.get(key)
    if (existing?.error) throw new Error(existing.error)
    if (existing?.receipt) return existing.receipt
    const pending = this.inFlight.get(key)
    if (pending) return pending
    const record = readProject(projectId)
    if (!record || !projectCanvas(record).generationCanvas.nodes.some(node => node.id === nodeId)) throw new Error('Save this node before generating')
    if ([...this.jobs.values()].some(job => job.projectId === projectId && job.nodeId === nodeId && !job.result && !job.error)) throw new Error('This shot already has a generation in progress')
    const job: GenerationJob = { key, projectId, nodeId, payload, createdAt: Date.now() }
    this.store(job)
    const submission = (async () => {
      try {
        await markWebGenerationOwned(projectId, nodeId, key)
        const { grantId } = { grantId: mintSpendGrant({ nodeIds: [nodeId], maxAttemptsPerNode: 1 }) }
        const receipt = await runTask({ ...payload, request: { ...payload.request, extras: { ...payload.request.extras, grantId } } })
        job.receipt = receipt; this.store(job); this.watch(job)
        await deliverWebOutcome(projectId, nodeId, { kind: 'progress', progress: { taskId: receipt.id, taskKind: payload.request.kind.includes('video') ? 'video' : 'image', phase: 'queued' } })
        void this.collect(job).catch(error => this.fail(job, error))
        return receipt
      } catch (error) { await this.fail(job, error); throw error }
      finally { this.inFlight.delete(key) }
    })()
    this.inFlight.set(key, submission)
    return submission
  }
  result(raw: { taskId: string; projectId?: string }) {
    const job = this.byTask.get(raw.taskId)
    if (!job || (raw.projectId && raw.projectId !== job.projectId)) throw new Error('Generation task does not belong to this project')
    const result = job.error ? { ...job.receipt!, status: 'failed' as const, error: job.error, assets: [] } : job.result ?? job.receipt!
    return { vendor: job.payload.vendor, result }
  }
  private async collect(job: GenerationJob) {
    let result = job.receipt!
    while (!job.error && result.status !== 'succeeded' && result.status !== 'failed') {
      await delay(2000)
      if (Date.now() - job.createdAt > 60 * 60 * 1000) throw new Error('Generation result collection timed out; the upstream task was not resubmitted')
      try {
        result = (await fetchTaskResult({ taskId: result.id, vendor: job.payload.vendor, projectId: job.projectId, nodeId: job.nodeId, taskKind: job.payload.request.kind, modelKey: job.payload.request.extras.modelKey, prompt: job.payload.request.prompt })).result
      } catch (error) {
        console.error('Generation query failed; retaining provider receipt:', job.receipt!.id, error instanceof Error ? error.message : String(error))
      }
    }
    if (job.error) return
    if (result.status === 'failed') throw new Error(result.error || 'ComfyUI generation failed')
    const record = readProject(job.projectId)
    const node = record && projectCanvas(record).generationCanvas.nodes.find(node => node.id === job.nodeId)
    if (node) {
      const normalized = normalizeCatalogTaskResult(result as Parameters<typeof normalizeCatalogTaskResult>[0], node)
      await deliverWebOutcome(job.projectId, job.nodeId, { kind: 'result', result: normalized })
    }
    job.result = result; this.store(job); unwatchComfyuiTask(result.id)
    hostEvents.emit('message', { channel: 'nomi:web:generation-completed', payload: { projectId: job.projectId, nodeId: job.nodeId, taskId: result.id } })
    console.log(JSON.stringify({ event: 'generation-completed', projectId: job.projectId, nodeId: job.nodeId, promptId: result.id }))
  }

  snapshot(projectId: string) {
    const latest = new Map<string, GenerationJob>()
    for (const job of this.jobs.values()) if (job.projectId === projectId && (!latest.has(job.nodeId) || latest.get(job.nodeId)!.createdAt < job.createdAt)) latest.set(job.nodeId, job)
    const record = readProject(projectId)
    return [...latest.values()].map(job => ({ key: job.key, node: record && projectCanvas(record).generationCanvas.nodes.find(node => node.id === job.nodeId), isPending: !job.result && !job.error }))
  }
  async cancel(taskId: string, projectId: string) {
    const job = this.byTask.get(taskId)
    if (!job || job.projectId !== projectId || job.result || job.error) return { ok: false, mode: 'failed' as const }
    const vendor = readCatalog().vendors.find(vendor => vendor.key === job.payload.vendor)
    if (!vendor?.baseUrlHint) return { ok: false, mode: 'failed' as const }
    const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) })
    const targeted = await post(comfyuiJobCancelEndpoint(vendor.baseUrlHint, taskId))
    let hasCancelled = false
    if (targeted.ok) hasCancelled = (await targeted.json() as { cancelled?: boolean }).cancelled === true
    else if (targeted.status === 404 || targeted.status === 405) {
      const queueResponse = await fetch(comfyuiEndpoint(vendor.baseUrlHint, 'queue'), { signal: AbortSignal.timeout(5000) })
      if (!queueResponse.ok) return { ok: false, mode: 'failed' as const }
      const queue = await queueResponse.json() as { queue_pending?: unknown[][]; queue_running?: unknown[][] }
      if (!queue.queue_running?.some(item => item[1] === taskId) && queue.queue_pending?.some(item => item[1] === taskId)) {
        const deleted = await post(comfyuiEndpoint(vendor.baseUrlHint, 'queue'), { delete: [taskId] })
        if (deleted.ok) {
          const checked = await fetch(comfyuiEndpoint(vendor.baseUrlHint, 'queue'), { signal: AbortSignal.timeout(5000) })
          const after = checked.ok ? await checked.json() as typeof queue : null
          hasCancelled = Boolean(after && !after.queue_running?.some(item => item[1] === taskId) && !after.queue_pending?.some(item => item[1] === taskId))
        }
      }
    }
    if (!hasCancelled) return { ok: false, mode: 'failed' as const }
    unwatchComfyuiTask(taskId)
    job.error = 'Generation cancelled by the user'; this.store(job)
    await deliverWebOutcome(projectId, job.nodeId, { kind: 'status', status: 'idle' })
    return { ok: true, mode: 'targeted' as const }
  }
  private async fail(job: GenerationJob, error: unknown) {
    if (job.receipt) unwatchComfyuiTask(job.receipt.id)
    job.error = error instanceof Error ? error.message : String(error)
    this.store(job)
    await deliverWebOutcome(job.projectId, job.nodeId, { kind: 'status', status: 'error', error: job.error })
    console.error(JSON.stringify({ event: 'generation-failed', projectId: job.projectId, nodeId: job.nodeId, error: job.error }))
  }
}
