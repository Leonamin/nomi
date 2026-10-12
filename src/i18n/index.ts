import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'
import { getDesktopBridge } from '../desktop/bridge'

import { normalizeDesktopLocale, SUPPORTED_LOCALES } from '../../electron/shared/contracts/locale'
export { SUPPORTED_LOCALES }
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'
export const LOCALE_STORAGE_KEY = 'nomi:locale:v1'

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** 已存储的用户语言偏好；从未存过（首启）返回 null，交由系统语言探测。 */
function readStoredLocaleRaw(): AppLocale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isAppLocale(stored) ? stored : null
  } catch {
    return null
  }
}

export function readStoredLocale(): AppLocale {
  return readStoredLocaleRaw() ?? DEFAULT_LOCALE
}

// Renderer and server share the same electron-free locale normalization.
export function normalizeSystemLocale(raw: string): AppLocale {
  return normalizeDesktopLocale(raw)
}

function detectSystemLocale(): AppLocale | null {
  try {
    const raw = getDesktopBridge()?.i18n?.getSystemLocale?.()
    if (!raw) return null
    return normalizeSystemLocale(raw)
  } catch {
    return null
  }
}

function resolveInitialLocale(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  return readStoredLocaleRaw() ?? detectSystemLocale() ?? DEFAULT_LOCALE
}

function syncDocumentLocale(locale: AppLocale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

function syncDesktopLocale(locale: AppLocale): void {
  if (typeof window !== 'undefined') getDesktopBridge()?.i18n?.setLocale(locale)
}

const initialLocale = resolveInitialLocale()

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  nonExplicitSupportedLngs: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
})

syncDocumentLocale(initialLocale)
syncDesktopLocale(initialLocale)

export function setAppLocale(locale: AppLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // localStorage 不可用时仍允许本次会话切换。
  }
  syncDocumentLocale(locale)
  syncDesktopLocale(locale)
  void i18n.changeLanguage(locale)
}

export function getAppLocale(): AppLocale {
  return isAppLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LOCALE
}

export default i18n
