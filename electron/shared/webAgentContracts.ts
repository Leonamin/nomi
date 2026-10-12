/** Native agent selection is independent from the generation model catalog. */
export type WebAgentEngine = 'opencode' | 'codex'
export type WebAgentSettings = { engine: WebAgentEngine; model: string; engines: readonly WebAgentEngine[] }
