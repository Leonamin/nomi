import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { desktopT } from '../../electron/desktopStrings'
import { getDesktopLocale, setDesktopLocale } from '../../electron/desktopLocale'
import { readPersistedLocale, writePersistedLocale } from '../../electron/settings/localePreference'
import { createPortableConfigBundle, parsePortableConfigBundle } from '../../electron/settings/portableConfig'
import i18n, { setAppLocale } from './index'
import { translateModelDisplayText } from './modelDisplayText'
import { mcpLocaleText } from '../../electron/capabilityCore/mcpLocaleText'
import { handbookContentForLocale } from '../workbench/onboarding/handbookContent'
import { projectGenerationRecovery } from '../../electron/capabilityCore/generationRecoveryProjection'

afterEach(() => { setDesktopLocale('zh-CN'); setAppLocale('zh-CN') })

describe('한국어 호스트와 도움말', () => {
  it('ComfyUI 동적 상태와 MCP 고정 안내를 한국어로 표시한다', () => {
    setAppLocale('ko')
    expect(i18n.resolvedLanguage).toBe('ko')
    expect(translateModelDisplayText('16GB 显存')).toBe('16GB VRAM')
    expect(translateModelDisplayText('已连上 ComfyUI')).toMatch(/[가-힣]/)
    expect(translateModelDisplayText('没连上（确认 ComfyUI 已在该地址启动）')).not.toMatch(/[一-鿿]/)
    expect(translateModelDisplayText('custom-model-id')).toBe('custom-model-id')
    expect(mcpLocaleText('ko', '草稿', 'draft')).toMatch(/[가-힣]/)
    expect(mcpLocaleText('en', '草稿', 'draft')).toBe('draft')
    expect(mcpLocaleText('zh-CN', '草稿', 'draft')).toBe('草稿')
  })
  it('서버 안내와 저장한 언어가 한국어를 유지한다', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-korean-locale-'))
    try {
      setDesktopLocale('ko-KR')
      expect(getDesktopLocale()).toBe('ko')
      expect(desktopT('common.cancel')).toBe('취소')
      writePersistedLocale(root, 'ko')
      expect(readPersistedLocale(root)).toBe('ko')
      const bundle = createPortableConfigBundle({ catalog: { vendors: [], models: [], mappings: [] }, defaults: {}, prompts: {}, preferences: { language: 'ko' } })
      expect(parsePortableConfigBundle(JSON.parse(JSON.stringify(bundle))).preferences?.language).toBe('ko')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('웹 도움말에서 사용할 수 있는 생성 경로와 저장 위치를 설명한다', () => {
    const web = handbookContentForLocale('ko', true)
    expect(web.firstWin[2].body).toContain('ComfyUI')
    expect(web.intentRoutes.some(route => route.body.includes('서버'))).toBe(true)
    expect(web.intentRoutes.some(route => route.body.includes('AI 자동 제작은 제공하지 않습니다'))).toBe(true)
    expect(handbookContentForLocale('en').title).toBe('Nomi quick-start guide')
    expect(handbookContentForLocale('zh-CN').title).toContain('Nomi')
  })

  it('접수 불확실 상태를 한국어로 설명해도 재제출 정책은 유지한다', () => {
    const state = { state: 'submission_unknown', profile: 'full_recovery', providerReference: 'task-123' } as const
    const ko = projectGenerationRecovery({ ...state, locale: 'ko' })
    const en = projectGenerationRecovery({ ...state, locale: 'en' })
    expect(ko.message).toContain('task-123')
    expect(ko.message).toMatch(/[가-힣]/)
    expect(ko.allowAutomaticRetry).toBe(false)
    expect(ko.allowNewAttempt).toBe(en.allowNewAttempt)
    expect(ko.nextAction).toBe(en.nextAction)
  })
})
