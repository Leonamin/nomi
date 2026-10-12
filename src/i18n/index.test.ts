import { afterEach, describe, expect, it, vi } from 'vitest'

function installBrowserState(storedLocale?: string): { values: Map<string, string>; documentElement: { lang: string } } {
  const values = new Map<string, string>()
  if (storedLocale !== undefined) values.set('nomi:locale:v1', storedLocale)
  const documentElement = { lang: '' }
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  vi.stubGlobal('document', { documentElement })
  return { values, documentElement }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('app locale', () => {
  it('defaults to zh-CN and rejects unsupported persisted locales', async () => {
    const { documentElement } = installBrowserState('fr')
    const locale = await import('./index')

    expect(locale.readStoredLocale()).toBe('zh-CN')
    expect(locale.getAppLocale()).toBe('zh-CN')
    expect(documentElement.lang).toBe('zh-CN')
    expect(locale.default.t('common.loading')).toBe('加载中')
  })

  it('restores and persists English while syncing the document language', async () => {
    const { values, documentElement } = installBrowserState('en')
    const locale = await import('./index')

    expect(locale.getAppLocale()).toBe('en')
    expect(documentElement.lang).toBe('en')
    expect(locale.default.t('common.loading')).toBe('Loading')

    locale.setAppLocale('zh-CN')
    expect(values.get(locale.LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(documentElement.lang).toBe('zh-CN')
    expect(locale.default.t('common.loading')).toBe('加载中')
  })

  it('supports zh-CN, en and ko', async () => {
    installBrowserState()
    const { isAppLocale, SUPPORTED_LOCALES } = await import('./index')

    expect(SUPPORTED_LOCALES).toEqual(['zh-CN', 'en', 'ko'])
    expect(isAppLocale('zh-CN')).toBe(true)
    expect(isAppLocale('en')).toBe(true)
    expect(isAppLocale('ko')).toBe(true)
    expect(isAppLocale('en-US')).toBe(false)
  })

  it('restores Korean and preserves interpolation across language switches', async () => {
    const { values, documentElement } = installBrowserState('ko')
    const locale = await import('./index')
    expect(locale.getAppLocale()).toBe('ko')
    expect(documentElement.lang).toBe('ko')
    expect(locale.default.t('director.node.stats', { objects: 2, cameras: 1 })).toBe('오브젝트 2개 · 카메라 1개')
    locale.setAppLocale('en')
    expect(locale.default.t('workspace.creation')).toBe('Create')
    locale.setAppLocale('ko')
    expect(values.get(locale.LOCALE_STORAGE_KEY)).toBe('ko')
    expect(locale.default.t('workspace.creation')).toMatch(/[가-힣]/)
    expect(documentElement.lang).toBe('ko')
  })

  it('composes web copy only after the web host is installed', async () => {
    installBrowserState('ko')
    Object.assign(window, { nomiDesktop: { platform: 'web' } })
    const locale = await import('./index')
    expect(locale.default.t('library.local')).toBe('서버에 저장됨')
    const { resources } = await import('./resources')
    expect(resources.ko.translation.library.local).not.toBe('서버에 저장됨')
  })

  it('detects Korean on first launch and forwards it to the host', async () => {
    const { documentElement } = installBrowserState()
    const setLocale = vi.fn()
    Object.assign(window, { nomiDesktop: { i18n: { getSystemLocale: () => 'ko-KR', setLocale } } })
    const locale = await import('./index')
    expect(locale.getAppLocale()).toBe('ko')
    expect(documentElement.lang).toBe('ko')
    expect(setLocale).toHaveBeenCalledWith('ko')
    locale.setAppLocale('zh-CN')
    expect(setLocale).toHaveBeenLastCalledWith('zh-CN')
  })
})
