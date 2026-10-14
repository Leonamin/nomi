import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'

import crypto from 'node:crypto'

import { createProductionRunRepository } from './productionRunRepository'
import type { ProductionRun } from './productionRunTypes'
import { applyProductionCommand } from './productionRunReducer'
import { productionRunPaths } from './productionRunPaths'
import { createCanvasLandingHost } from './canvasLandingHost'

/**
 * 历史容忍：`generationPlan.editorial` 是 PR #828 分支上短暂存在过的第二份分镜存储，
 * **从未进过 main**（`git show origin/main:electron/productionRun/productionRunTypes.ts` 0 命中），
 * 所以没有任何发布过的构建写过它。但一台开过那个分支构建的机器上可能留着这样一条记录。
 *
 * 这条测试钉住那条记录今天的命运：**读得进、不崩、字段被忽略、画布节点不丢**，
 * 而写路径再也不产生它。容忍靠的是 Run 落盘用的是宽松 JSON.parse（没有 strict schema）——
 * 这不是碰巧，所以要有人一直盯着它。
 */
let root = ''
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-legacy-editorial-')) })
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }) })

const repository = () => createProductionRunRepository({ projectDirResolver: id => (id === 'project-1' ? root : null), now: () => '2026-09-21T00:00:00.000Z' })
const candidate = { candidateId: 'shot-1', revision: 1, moduleId: 'generation.single-shot', providerId: 'fixture', modelId: 'fixture-image',
  mode: 'text_to_image', prompt: 'Legacy prompt', parameters: {}, references: [] }

function legacyRun() {
  const created = repository().createGenerationDraft({
    projectId: 'project-1', operationId: 'op-legacy', candidate,
    origin: { host: 'nomi', sourceDocument: { documentId: 'doc', revision: 1, contentHash: 'hash' } },
    shots: [{ shotId: 'shot-1', candidate }], cardHidden: true,
  })
  // 手写那条历史记录：在这个分支之外，没有任何代码路径还能产生它。落盘信封自带校验和，
  // 所以连同校验和一起按仓库自己的算法重算——不然我们测的是「坏文件被拒绝」，不是「旧字段被容忍」。
  const snapshot = productionRunPaths(root, 'op-legacy').snapshot
  const raw = JSON.parse(fs.readFileSync(snapshot, 'utf8'))
  raw.run.generationPlan.editorial = { title: 'Legacy plan', anchors: [], shots: [{ index: 1, shotId: 'shot-1', shotKind: 'image', durationSec: 0, anchorIds: [], prompt: 'Legacy prompt' }] }
  raw.run.generationPlan.shots[0].nodeId = 'node-1'
  const value = { schemaVersion: raw.schemaVersion, snapshotCursor: raw.snapshotCursor, run: raw.run }
  fs.writeFileSync(snapshot, JSON.stringify({ ...value, checksum: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') }))
  return created
}

it('a record still carrying the removed editorial field loads, keeps its bindings, and no longer reports that field', () => {
  legacyRun()
  const run = repository().read('project-1', 'op-legacy')
  expect(run, 'a historical record must still open').toBeTruthy()
  expect(run!.generationPlan!.candidate.prompt).toBe('Legacy prompt')
  // 已落的画布绑定还在——用户已经放到画布上的节点不因为这次删除而失联。
  expect(run!.generationPlan!.shots?.[0].nodeId).toBe('node-1')
  expect(repository().list('project-1').map(summary => summary.runId)).toEqual(['op-legacy'])
})

it('a historical document-admitted record with bindings still reconciles onto the canvas, and one without them still does not', async () => {
  legacyRun()
  const requested: string[] = []
  const host = createCanvasLandingHost({
    readRun: (projectId, runId) => repository().read(projectId, runId),
    command: async () => undefined,
    requestRenderer: async op => { requested.push(op); return { bindings: [] } },
    resolveProjectRoot: () => root,
    isProjectOpen: () => true,
  })
  expect(await host.landCanvasBestEffort('project-1', 'op-legacy')).toBe(true)
  expect(requested, 'a record whose shots already carry nodeIds stays reconcilable').toEqual(['production.materialize-shots'])

  repository().createGenerationDraft({ projectId: 'project-1', operationId: 'op-unplaced', candidate,
    origin: { host: 'nomi', sourceDocument: { documentId: 'doc', revision: 1, contentHash: 'hash' } },
    shots: [{ shotId: 'shot-1', candidate }], cardHidden: true })
  requested.length = 0
  expect(await host.landCanvasBestEffort('project-1', 'op-unplaced')).toBe(false)
  expect(requested, 'a document-admitted plan the user never placed must stay off the canvas').toEqual([])
})

it('rejects new duplicate author metadata in source-backed durable candidates', () => {
  const runtimeCandidate = { ...candidate, storyboard: { anchorIds: [] } }
  expect(() => repository().createGenerationDraft({ projectId: 'project-1', operationId: 'source-create',
    origin: { host: 'nomi', sourceDocument: { documentId: 'doc', revision: 1, contentHash: 'hash' } },
    candidate: runtimeCandidate,
  })).toThrow('source_candidate_author_metadata_requires_project_owner')
})
it.each(['generation.patch', 'generation.revise'] as const)('guards direct durable %s entrances', type => {
  const repo = repository()
  const run = repo.createGenerationDraft({ projectId: 'project-1', operationId: 'source-patch', candidate,
    origin: { host: 'nomi', sourceDocument: { documentId: 'doc', revision: 1, contentHash: 'hash' } } })
  expect(() => repo.execute('project-1', run.runId, { commandId: type, expectedRevision: run.revision, type,
    payload: { patch: { storyboard: { anchorIds: [] } } }, issuedAt: '2026-09-21T00:00:00.000Z' })).toThrow('source_candidate_author_metadata_requires_project_owner')
  expect(repo.read('project-1', run.runId)!.generationPlan!.candidate).not.toHaveProperty('storyboard')
})

it('preserves legacy duplicated author metadata on read and refuses normalization edits without deleting meaning', () => {
  const created = legacyRun()
  const snapshot = productionRunPaths(root, created.runId).snapshot
  const raw = JSON.parse(fs.readFileSync(snapshot, 'utf8'))
  const author = { anchorIds: ['legacy-anchor'], promptSegments: [{ key: 'legacy', start: 0, end: 1 }] }
  raw.run.generationPlan.candidate.storyboard = author
  raw.run.generationPlan.shots[0].candidate.storyboard = author
  const value = { schemaVersion: raw.schemaVersion, snapshotCursor: raw.snapshotCursor, run: raw.run }
  fs.writeFileSync(snapshot, JSON.stringify({ ...value, checksum: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') }))
  const repo = repository(), run = repo.read('project-1', created.runId)!
  expect(run.generationPlan!.candidate).toMatchObject({ storyboard: author })
  expect(() => applyProductionCommand(run, { commandId: 'normalize-legacy', expectedRevision: run.revision,
    type: 'generation.patch', payload: { patch: { parameters: {} } }, issuedAt: '2026-09-21T00:00:00.000Z' }, '2026-09-21T00:00:00.000Z')).toThrow('source_candidate_author_metadata_requires_project_owner')
  expect(repo.read('project-1', created.runId)!.generationPlan!.candidate).toMatchObject({ storyboard: author })
})

it('retains non-source generation behavior for legacy records without origin metadata', () => {
  const created = repository().createGenerationDraft({ projectId: 'project-1', operationId: 'legacy-without-origin', candidate, origin: { host: 'nomi' } })
  const { origin: _origin, ...legacy } = created
  const effect = applyProductionCommand(legacy as ProductionRun, { commandId: 'legacy-patch', expectedRevision: created.revision,
    type: 'generation.patch', payload: { patch: { prompt: 'Updated legacy prompt' } }, issuedAt: '2026-09-21T00:00:00.000Z' }, '2026-09-21T00:00:00.000Z')
  expect(effect.run.generationPlan!.candidate.prompt).toBe('Updated legacy prompt')
})
