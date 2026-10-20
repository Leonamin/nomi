// ComfyUI 产物进项目资产库也过落盘关口：字节与产物种类相符才收，错类型带原话拒收（V-1213）。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { matchNomiErrorCode } from '../electron/shared/nomiErrorCodes'
import { writeWorkspaceManifest } from '../electron/workspace/workspaceManifest'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-comfy-kind-'))
const fixtures = path.join(__dirname, '../electron/providerAdapter/__fixtures__/certification-media')
vi.mock('../electron/projects/repository', async importOriginal => ({
  ...await importOriginal<typeof import('../electron/projects/repository')>(),
  projectDirById: () => root,
  resolveProjectRelativePath: (_id: string, rel: string) => path.join(root, rel),
}))
vi.mock('../electron/assets/localAssetFile', async importOriginal => ({
  ...await importOriginal<typeof import('../electron/assets/localAssetFile')>(),
  absolutePathFromLocalAssetUrl: (url: string) => url.replace('nomi-local://asset/', ''),
}))
const { materializeComfyuiProductionOutput } = await import('./comfyuiProductionProvider')

writeWorkspaceManifest(root, { id: 'p', name: 'p', version: 2, createdAt: 1, updatedAt: 1, savedAt: 1, revision: 0,
  immutableProjectUuid: '11111111-1111-4111-8111-111111111111', projectGeneration: 1, payload: {} })
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('materializeComfyuiProductionOutput 落盘关口', () => {
  it.each([['valid.png', 'image'], ['valid.mp4', 'video']] as const)('字节与种类相符照收：%s', (file, kind) => {
    const receipt = materializeComfyuiProductionOutput('p', `task-${file}`, { kind, url: `nomi-local://asset/${path.join(fixtures, file)}` })
    expect(receipt.projectRelativePath).toBeTruthy()
  })
  it('任务要视频、拿到图片字节：不落盘并说清', () => {
    let thrown: unknown
    try { materializeComfyuiProductionOutput('p', 'task-bad', { kind: 'video', url: `nomi-local://asset/${path.join(fixtures, 'valid.png')}` }) } catch (e) { thrown = e }
    expect(matchNomiErrorCode(thrown)).toBe('retrieval-download')
    expect(String((thrown as Error).message)).not.toMatch(/\{\{|\{got\}/)
  })
})
