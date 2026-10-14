import { describe, it, expect, vi } from 'vitest'
import { settleWebProductionCandidates } from './productionRuntime'
import { createProductionRunRepository } from '../electron/productionRun/productionRunRepository'
import type { ProductionRun } from '../electron/productionRun/productionRunTypes'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
describe('web candidate-only production scope', () => {
  it('uses a host-owned original repository policy without creating QA/export stages', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-candidate-policy-'))
    const repository = createProductionRunRepository({ projectDirResolver: () => root, semanticGenerationStages: 'candidates-only' })
    const candidate = { candidateId: 'candidate', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'model', mode: 'text_to_image', prompt: 'Fox', parameters: {}, references: [] }
    const run = repository.createGenerationDraft({ projectId: 'project', operationId: 'operation', origin: { host: 'nomi' }, candidate, shots: [{ shotId: 'shot', role: 'shot', included: true, candidate }] })
    expect(run.stages.map(stage => stage.stageId)).toEqual(['generate'])
    fs.rmSync(root, { recursive: true, force: true })
  })
  it('refuses false completion while a job or a local artifact is missing', () => {
    const run = { status: 'running', stages: [{ stageId: 'generate' }], jobs: [], artifacts: [], generationPlan: { shots: [{ shotId: 'shot', included: true }] } } as unknown as ProductionRun
    const repository = { read: () => run, execute: vi.fn() }
    expect(settleWebProductionCandidates(repository, 'project', 'run')).toBe(false)
    run.jobs = [{ jobId: 'job', status: 'ready', metadata: { shotId: 'shot' } }] as ProductionRun['jobs']
    expect(settleWebProductionCandidates(repository, 'project', 'run')).toBe(false)
    expect(repository.execute).not.toHaveBeenCalled()
  })
  it('does not finish a full pipeline or claim an excluded QA stage passed', () => {
    const run = { status: 'running', stages: [{ stageId: 'generate' }, { stageId: 'qa' }] } as unknown as ProductionRun
    const repository = { read: () => run, execute: vi.fn() }
    expect(settleWebProductionCandidates(repository, 'project', 'run')).toBe(false)
    expect(repository.execute).not.toHaveBeenCalled()
  })
})
