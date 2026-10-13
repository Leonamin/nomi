import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

/**
 * 「홈을 대체하는 화면에는 나가는 길과 다시 들어오는 길을 함께 준다」를 고정한다.
 * 2026-10-13 실사용: 자체 점검 화면에 들어가면 나갈 수 없었다(사용자 보고).
 */
describe('self-check screen keeps an exit and a way back', () => {
  it('offers a defer action from inside the panel', () => {
    const panel = read('src/ui/onboarding/IntegrationSelfCheckPanel.tsx')
    expect(panel).toContain('onDefer')
    expect(panel).toContain('modelSetup.integrationSelfCheckDefer')
  })

  it('gates the full-screen replacement on the deferral and renders a re-entry row', () => {
    const drawer = read('src/ui/onboarding/OnboardingDrawer.tsx')
    expect(drawer).toContain('deferredVerificationId')
    expect(drawer).toMatch(/verificationHandoff\.requestId !== deferredVerificationId/)
    expect(drawer).toContain('modelSetup.integrationSelfCheckPending')
    expect(drawer).toMatch(/setDeferredVerificationId\(null\)/)
  })
})
