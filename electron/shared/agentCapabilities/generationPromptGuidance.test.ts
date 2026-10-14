import { describe, expect, it } from 'vitest'
import { CANVAS_NODE_PROMPT_GUIDELINES } from './canvasWrite'
import { draftShotSchema } from './verbs/writeVerbs'
import { buildLanguageRule } from '../../harness/context/agentContext'
import { setDesktopLocale } from '../../desktopLocale'

describe('generation prompt language ownership', () => {
  it.each(['ko', 'en', 'zh-CN'] as const)('separates %s creator language from model-facing prompts', (locale) => {
    setDesktopLocale(locale)
    const rule = buildLanguageRule()
    expect(rule).toContain('Use English for model-facing generation prompts')
    expect(rule).toContain('Preserve the original source document')
    expect(rule).not.toMatch(/一律用简体中文|must be written in Simplified Chinese|generation descriptions in Korean/)
    setDesktopLocale('zh-CN')
  })

  it('publishes the same instruction to canonical image, keyframe and video authoring', () => {
    expect(CANVAS_NODE_PROMPT_GUIDELINES.join('\n')).toContain('Use English for model-facing generation prompts')
    expect(CANVAS_NODE_PROMPT_GUIDELINES.join('\n')).not.toContain('SAME language')
    expect(draftShotSchema.shape.prompt.description).not.toContain('user\'s language')
    expect(draftShotSchema.parse({ title: '붉은 종이등', prompt: 'A red paper lantern glowing at night' })).toMatchObject({ title: '붉은 종이등' })
  })
})
