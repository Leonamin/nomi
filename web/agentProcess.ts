import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import type { WebAgentEngine } from '../electron/shared/webAgentContracts'

export type NativeAgentEvent =
  | { kind: 'session'; id: string }
  | { kind: 'text' | 'thinking'; id: string; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'usage'; input: number; output: number; cacheRead: number }

/**
 * OpenCode v2 的配置形状（2026-10-13 真机实测，逐条改错）：
 *  · `mcp.<name>` 直接键；旧形状 `mcp.servers.<name>` 会被判 malformed 并**整个跳过**（日志
 *    `path=$.mcp.servers.nomi kind=invalid action="skipped malformed recognized value"`）。
 *  · remote MCP 的工具走 Code Mode 的 `execute` 动作；`deny *` 若不显式放行 `execute`，模型根本
 *    发不出工具调用（只会把工具语法当文本瞎编：`<｜｜DSML｜｜ invoke name="nomi_get_project">`）。
 *  · `references` / `codemode` 不是 v2 合法字段，去掉。
 *  · 用 `default_agent` 选 agent，**不要**在 `run` 上传 `--agent`——实测 `--agent nomi` 会切断工具调用。
 */
export function nativeAgentConfig(url: string, otherServers: string[]) {
  const permissions = [{ action: '*', resource: '*', effect: 'deny' }, { action: 'execute', resource: '*', effect: 'allow' }, { action: 'nomi_*', resource: '*', effect: 'allow' }]
  return {
    permissions,
    default_agent: 'nomi',
    agents: { nomi: { description: 'Nomi personal video assistant', mode: 'primary', permissions, system: 'Use only Nomi MCP tools. Do not access files, shell, web or other agents. Never regenerate, select candidates or change the timeline without the user requesting it.' } },
    mcp: {
      ...Object.fromEntries(otherServers.map(key => [key, { enabled: false }])),
      nomi: { type: 'remote', url, oauth: false, timeout: 1800000, headers: { Authorization: 'Bearer {env:NOMI_WEB_AGENT_MCP_TOKEN}' } },
    } as Record<string, Record<string, unknown>>,
  }
}

/** Installed CLIs emit JSONL; only provider facts cross into Nomi projections. */
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function count(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0 }
export function parseNativeAgentEvent(engine: WebAgentEngine, value: unknown): NativeAgentEvent | undefined {
  const raw = record(value); const part = record(raw.part); const item = record(raw.item); const error = record(raw.error)
  if (raw.type === 'error') return { kind: 'error', text: String(error.message || raw.message || 'Native agent failed') }
  if (engine === 'opencode') {
    if ((raw.type === 'text' || raw.type === 'reasoning') && typeof part.id === 'string' && typeof part.text === 'string') return { kind: raw.type === 'text' ? 'text' : 'thinking', id: part.id, text: part.text }
    if (raw.type === 'step_finish' && part.tokens) { const tokens = record(part.tokens); return { kind: 'usage', input: count(tokens.input), output: count(tokens.output), cacheRead: count(record(tokens.cache).read) } }
  } else {
    if (raw.type === 'thread.started' && typeof raw.thread_id === 'string') return { kind: 'session', id: raw.thread_id }
    if (raw.type === 'item.completed' && item.type === 'agent_message' && typeof item.id === 'string' && typeof item.text === 'string') return { kind: 'text', id: item.id, text: item.text }
    if (raw.type === 'turn.failed') return { kind: 'error', text: String(error.message || 'Codex turn failed') }
    if (raw.type === 'turn.completed' && raw.usage) { const usage = record(raw.usage); return { kind: 'usage', input: count(usage.input_tokens), output: count(usage.output_tokens), cacheRead: count(usage.cached_input_tokens) } }
  }
}

/** 엔진 실행 파일: env override + 기존 기본값. 설치 위치가 다르면 env로만 바꾼다. */
function nativeAgentExecutable(engine: WebAgentEngine): string {
  return engine === 'opencode'
    ? process.env.NOMI_WEB_OPENCODE_BIN || path.join(os.homedir(), '.opencode/bin/opencode')
    : process.env.NOMI_WEB_CODEX_BIN || path.join(os.homedir(), '.local/bin/codex')
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const MODEL_ID = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/
/** `opencode models` 每行一个 `provider/model`（可能带 ANSI）。Nomi 只认这个形状，不发明模型 id。 */
export function parseNativeAgentModels(stdout: string): string[] {
  const seen = new Set<string>()
  for (const line of stdout.split('\n')) {
    const value = line.replace(ANSI, '').trim()
    if (MODEL_ID.test(value)) seen.add(value)
  }
  return [...seen].slice(0, 500)
}

const CODEX_CONFIG_MODEL = /^\s*model\s*=\s*"([^"]+)"\s*$/m
/** Codex CLI 没有列模型的子命令；只能把它**配置里写着的**那个模型如实报出来，不发明列表。 */
export function parseCodexConfiguredModel(configText: string): string[] {
  const value = CODEX_CONFIG_MODEL.exec(configText)?.[1]?.trim()
  return value ? [value] : []
}

/**
 * 엔진이 **실제로 아는** 모델 목록.
 * · OpenCode: `models` 서브커맨드가 인증된 provider를 모두 돌려준다.
 * · Codex: 목록 서브커맨드가 없어 설정의 `model` 한 줄만 정직하게 보고한다.
 */
export async function listNativeAgentModels(engine: WebAgentEngine, signal: AbortSignal): Promise<string[]> {
  if (engine !== 'opencode') {
    try {
      const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
      return parseCodexConfiguredModel(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'))
    } catch { return [] }
  }
  return new Promise<string[]>(resolve => {
    const child = spawn(nativeAgentExecutable(engine), ['models'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    let stdout = ''
    let settled = false
    const finish = (value: string[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { process.kill(-child.pid!, 'SIGTERM') } catch { /* already exited */ }
      resolve(value)
    }
    const timer = setTimeout(() => finish([]), 10_000)
    timer.unref?.()
    child.stdout.on('data', data => { stdout += data.toString() })
    child.on('error', () => finish([]))
    child.on('close', () => finish(parseNativeAgentModels(stdout)))
    if (signal.aborted) finish([])
    else signal.addEventListener('abort', () => finish([]), { once: true })
  })
}

export type NativeAgentTurn = {
  engine: WebAgentEngine; model: string; prompt: string; directory: string; sessionId?: string
  mcpUrl: string; mcpToken: string; signal: AbortSignal; onEvent: (event: NativeAgentEvent) => void
}
export async function runNativeAgent(turn: NativeAgentTurn): Promise<void> {
  const env = { ...process.env, NOMI_WEB_AGENT_MCP_TOKEN: turn.mcpToken }
  // Existing user authentication stays in its owning installation. No token files are copied.
  const executable = nativeAgentExecutable(turn.engine)
  let args: string[]
  if (turn.engine === 'opencode') {
    const configPath = path.join(os.homedir(), '.config/opencode/opencode.json')
    const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
    Object.assign(env, { OPENCODE_CONFIG_CONTENT: JSON.stringify(nativeAgentConfig(turn.mcpUrl, Object.keys(config.mcp?.servers || {}))), OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_CONFIG_PROJECT_DISABLE: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true' })
    args = ['run', '--standalone', '--format', 'json', '--model', turn.model, ...(turn.sessionId ? ['--session', turn.sessionId] : []), turn.prompt]
  } else {
    args = ['exec', ...(turn.sessionId ? ['resume', turn.sessionId] : []), '--json', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--disable', 'shell_tool', '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '--disable', 'multi_agent', '-c', 'web_search="disabled"', '-c', 'sandbox_mode="read-only"', '-c', `mcp_servers.nomi.url=${JSON.stringify(turn.mcpUrl)}`, '-c', 'mcp_servers.nomi.bearer_token_env_var="NOMI_WEB_AGENT_MCP_TOKEN"', '-c', 'mcp_servers.nomi.tool_timeout_sec=1800', '-c', 'mcp_servers.nomi.default_tools_approval_mode="approve"', ...(turn.model ? ['--model', turn.model] : []), '-']
  }
  fs.mkdirSync(turn.directory, { recursive: true, mode: 0o700 })
  const child = spawn(executable, args, { cwd: turn.directory, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
  if (turn.engine === 'codex') child.stdin.end(turn.prompt)
  else child.stdin.end()
  let diagnostic = ''
  let hasProviderError = false
  const lines = readline.createInterface({ input: child.stdout })
  lines.on('line', line => {
    try {
      const raw = JSON.parse(line)
      if (turn.engine === 'opencode' && typeof raw.sessionID === 'string') turn.onEvent({ kind: 'session', id: raw.sessionID })
      const event = parseNativeAgentEvent(turn.engine, raw)
      if (event) { if (event.kind === 'error') hasProviderError = true; turn.onEvent(event) }
    } catch { /* CLI progress text has no domain meaning. */ }
  })
  child.stderr.on('data', data => { diagnostic = (diagnostic + data.toString()).slice(-4000) })
  const stop = () => { try { process.kill(-child.pid!, 'SIGTERM') } catch { /* already exited */ } }
  turn.signal.addEventListener('abort', stop, { once: true })
  if (turn.signal.aborted) stop()
  try {
    await new Promise<void>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', code => code === 0 && !hasProviderError && !turn.signal.aborted ? resolve() : reject(new Error(turn.signal.aborted ? 'Agent stopped by the user' : hasProviderError ? 'Native provider reported an error' : diagnostic || `Native agent exited with ${code}`)))
    })
  } finally { turn.signal.removeEventListener('abort', stop); lines.close(); stop() }
}
