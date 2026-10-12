import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('candidate command feedback visibility', () => {
  const source = readFileSync('src/workbench/generationCanvas/nodes/NodeResultStack.tsx', 'utf8')
  it('presents feedback inside the result tray instead of behind the stacked cards', () => {
    const tray = source.slice(source.indexOf('<motion.section'), source.indexOf('</motion.section>'))
    expect(tray).toContain('role="status"')
    expect(source.slice(source.indexOf('return (\n    <>'), source.indexOf('<CardStackPeeks'))).not.toContain('role="status"')
  })
  it('routes both failed and successful replacement through the same inline feedback owner', () => {
    expect(source).toContain("reportFeedback(t('generationCommon.resultStack.timelineReplaced'))")
    expect(source).toContain("'generationCommon.resultStack.timelineTooShort'")
    expect(source).toContain("level: 'inline', present: setFeedback")
  })
})
