import ko from '../locales/mcpKo.json'
import type { DesktopLocale } from '../desktopLocale'

/** Fixed MCP guidance follows the app language. External/dynamic details retain their source text. */
export function mcpLocaleText(locale: DesktopLocale, zh: string, en: string): string {
  if (locale === 'ko') return (ko as Readonly<Record<string, string>>)[en] ?? en
  return locale === 'en' ? en : zh
}
