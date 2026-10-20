import { createRequire } from 'node:module'
import path from 'node:path'
import type { SkillRecord } from '../electron/skills/skillStore'

/**
 * 웹 호스트는 번들로 돌기 때문에 CJS→아일랜드 브리지(`laneNativeLoader.cjs`)를 `__filename`
 * 기준으로 찾으면 번들 위치로 어긋난다. 배포 작업 디렉터리 기준으로 한 곳에서만 연다 —
 * 스킬 목록 투영(선택기)과 제작 준비가 같은 발견 결과를 쓰도록 공유하는 유일한 seam.
 * 테스트는 이 모듈을 바꿔 끼워 전송만 아일랜드로 바꾼다(같은 readSkillRecords, 같은 정렬 루트).
 */
export type NativeSkillLoader = {
  readSkillRecords(): Promise<SkillRecord[]>
  renderSelectedSkillPrompt(skill: SkillRecord): Promise<string>
}

export function nativeSkillLoader(): NativeSkillLoader {
  return createRequire(__filename)(path.join(process.cwd(), 'dist-electron/agentLane/laneNativeLoader.cjs')) as NativeSkillLoader
}
