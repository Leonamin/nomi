import { describe, expect, it, vi } from 'vitest'

// 전송만 바꾸고 동작은 그대로 둔다: 배포 웹 호스트는 cwd 기준 CJS→아일랜드 브리지
// (`dist-electron/agentLane/laneNativeLoader.cjs`)를 쓰고, vitest는 소스로 돌기 때문에
// 같은 아일랜드의 같은 함수를 직접 연결한다(tests/setup/skillCatalogBridge.ts와 같은 규율).
const island = vi.hoisted(() => ({
  readSkillRecords: async () =>
    (await import('../electron/agentLane/laneSkillCatalog.mjs')).readSkillRecords(),
  renderSelectedSkillPrompt: async (skill: unknown) =>
    (await import('../electron/agentLane/laneSkillPrompt.mjs')).renderSelectedSkillPrompt(skill as never),
}))

vi.mock('./nativeSkillLoader', () => ({
  nativeSkillLoader: () => ({
    readSkillRecords: island.readSkillRecords,
    renderSelectedSkillPrompt: island.renderSelectedSkillPrompt,
  }),
}))
vi.mock('../electron/skills/skillStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../electron/skills/skillStore')>()
  return { ...actual, readSkillRecords: island.readSkillRecords }
})

import { dispatchWebRpc } from './rpc'
import { createWebSurface } from './surface'
import { prepareWebCreationContext, readWebSkillRecords } from './creationContext'
import { listSkillsForRenderer } from '../electron/skills/skillIpc'
import { projectSkillsForRenderer } from '../electron/skills/skillIpc'

type Row = { name: string; contentHash: string }
const pickerRows = () =>
  dispatchWebRpc('nomi:skill:list', [], createWebSurface('http://127.0.0.1:9031')) as Promise<Row[]>

describe('original installed skill picker in the web host', () => {
  it('serves the original desktop projection from the shared discovery, without a second web source', async () => {
    const rows = await pickerRows()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.name && row.contentHash)).toBe(true)
    // 데스크톱 IPC(`nomi:skill:list` → listSkillsForRenderer)와 같은 DTO, 같은 순서.
    expect(rows).toEqual(await listSkillsForRenderer())
    // 웹 선택기와 제작 준비가 같은 발견 결과를 읽는다(두 번째 웹 카탈로그 없음).
    expect(rows).toEqual(projectSkillsForRenderer(await readWebSkillRecords()))
  })

  it('admits a skill chosen from the picker through the same version authority as creation preparation', async () => {
    const [selected] = await pickerRows()
    const context = await prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, skillKey: selected.name, expectedSkillHash: selected.contentHash })
    expect(context.skillSnapshot).toMatchObject({ name: selected.name, contentHash: selected.contentHash })
  })
})
