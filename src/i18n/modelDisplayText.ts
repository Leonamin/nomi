import i18n from './index'
import { enModelDisplayText } from './locales/modelDisplayText'
import koModelDisplayText from './locales/ko/modelDisplayText.json'

export function translateModelDisplayText(value: string): string {
  const language = i18n.resolvedLanguage || i18n.language
  if (language.startsWith('ko')) {
    return ((koModelDisplayText as Readonly<Record<string, string>>)[value] ?? value)
      .replace(/\s显存/g, ' VRAM')
      .replace('已连上 ComfyUI', 'ComfyUI에 연결됐어요')
      .replace('没连上（确认 ComfyUI 已在该地址启动）', '연결되지 않았어요. 이 주소에서 ComfyUI가 실행 중인지 확인하세요')
  }
  if (!language.startsWith('en')) return value
  return (enModelDisplayText[value] ?? value)
    .replace(/\s显存\b/g, ' VRAM')
    .replace('已连上 ComfyUI', 'Connected to ComfyUI')
    .replace('没连上（确认 ComfyUI 已在该地址启动）', 'Not connected (make sure ComfyUI is running at this address)')
}
