import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
/** 주석을 벗기고 본다: 이 화면을 설명하는 주석 자체가 게이트를 흔들면 안 된다(check:walkthroughs). */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * 「홈을 대체하는 화면에는 나가는 길과 다시 들어오는 길을 함께 준다」를 고정한다.
 * 2026-10-13 실사용: 자체 점검 화면에 들어가면 나갈 수 없었다(사용자 보고).
 * 나가는 길(보류)과 재진입 입구는 IntegrationSelfCheckGate가 소유한다 — OnboardingDrawer의 795줄
 * 기준선(규칙 12)을 넘기지 않으려고 분리한 자리라, 단언도 그 파일을 본다.
 */
describe('self-check screen keeps an exit and a way back', () => {
  it('offers a defer action from inside the panel', () => {
    const panel = stripComments(read('src/ui/onboarding/IntegrationSelfCheckPanel.tsx'))
    expect(panel).toContain('onDefer')
    expect(panel).toContain('modelSetup.integrationSelfCheckDefer')
  })

  it('gates the full-screen replacement on the deferral and renders a re-entry row', () => {
    const gate = stripComments(read('src/ui/onboarding/IntegrationSelfCheckPanel.tsx'))
    expect(gate).toContain('deferredId')
    expect(gate).toMatch(/handoff\.requestId !== deferredId/)
    expect(gate).toContain('modelSetup.integrationSelfCheckPending')
    expect(gate).toMatch(/setDeferredId\(null\)/)
  })
})
