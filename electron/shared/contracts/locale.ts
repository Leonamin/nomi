// Shared renderer / host locale contract; no runtime dependencies.
export const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ko'] as const
export type DesktopLocale = (typeof SUPPORTED_LOCALES)[number]

/** Chinese and Korean systems retain their language; other systems use English. No signal uses the app default. */
export function normalizeDesktopLocale(value: unknown): DesktopLocale {
  if (typeof value !== 'string') return 'zh-CN'
  const raw = value.trim().toLowerCase()
  if (!raw) return 'zh-CN'
  if (raw.startsWith('ko')) return 'ko'
  return raw.startsWith('zh') ? 'zh-CN' : 'en'
}
