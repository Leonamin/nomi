/** Native agent selection is independent from the generation model catalog. */
export type WebAgentEngine = 'opencode' | 'codex'
/** 프로젝트별 대화가 기억하는 선택. 비어 있으면 엔진의 저장된 기본값으로 되돌린다. */
export type WebAgentSelection = { engine?: WebAgentEngine; model?: string }
export type WebAgentSettings = {
  engine: WebAgentEngine
  model: string
  /** 엔진이 실제로 인증한 모델 id(`provider/model`). Nomi는 모델을 만들어내지 않는다. */
  models: readonly string[]
  engines: readonly WebAgentEngine[]
  /** 목록을 못 읽었을 때의 이유(있으면 UI가 정직하게 표시). */
  modelsError?: string
}
