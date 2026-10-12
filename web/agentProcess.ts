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

export function nativeAgentConfig(url: string, otherServers: string[]) {
  const permissions = [{ action: '*', resource: '*', effect: 'deny' }, { action: 'nomi_*', resource: '*', effect: 'allow' }]
  return {
    permissions,
    references: [],
    default_agent: 'nomi',
    agents: { nomi: { description: 'Nomi personal video assistant', mode: 'primary', permissions, system: 'Use only Nomi MCP tools. Do not access files, shell, web or other agents. Never regenerate, select candidates or change the timeline without the user requesting it.' } },
    mcp: { servers: {
      ...Object.fromEntries(otherServers.map(key => [key, { enabled: false }])),
      nomi: { type: 'remote', url, oauth: false, codemode: false, timeout: 1800000, headers: { Authorization: 'Bearer {env:NOMI_WEB_AGENT_MCP_TOKEN}' } },
    } } as { servers: Record<string, Record<string, unknown>> },
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

export type NativeAgentTurn = {
  engine: WebAgentEngine; model: string; prompt: string; directory: string; sessionId?: string
  mcpUrl: string; mcpToken: string; signal: AbortSignal; onEvent: (event: NativeAgentEvent) => void
}
export async function runNativeAgent(turn: NativeAgentTurn): Promise<void> {
  const env = { ...process.env, NOMI_WEB_AGENT_MCP_TOKEN: turn.mcpToken }
  // Existing user authentication stays in its owning installation. No token files are copied.
  const executable = turn.engine === 'opencode'
    ? process.env.NOMI_WEB_OPENCODE_BIN || path.join(os.homedir(), '.opencode/bin/opencode')
    : process.env.NOMI_WEB_CODEX_BIN || path.join(os.homedir(), '.local/bin/codex')
  let args: string[]
  if (turn.engine === 'opencode') {
    const configPath = path.join(os.homedir(), '.config/opencode/opencode.json')
    const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
    Object.assign(env, { OPENCODE_CONFIG_CONTENT: JSON.stringify(nativeAgentConfig(turn.mcpUrl, Object.keys(config.mcp?.servers || {}))), OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_CONFIG_PROJECT_DISABLE: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true' })
    args = ['run', '--standalone', '--format', 'json', '--model', turn.model, '--agent', 'nomi', ...(turn.sessionId ? ['--session', turn.sessionId] : []), turn.prompt]
  } else {
    args = ['exec', ...(turn.sessionId ? ['resume', turn.sessionId] : []), '--json', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--disable', 'shell_tool', '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '--disable', 'multi_agent', '-c', 'web_search="disabled"', '-c', 'sandbox_mode="read-only"', '-c', `mcp_servers.nomi.url=${JSON.stringify(turn.mcpUrl)}`, '-c', 'mcp_servers.nomi.bearer_token_env_var="NOMI_WEB_AGENT_MCP_TOKEN"', '-c', 'mcp_servers.nomi.tool_timeout_sec=1800', ...(turn.model ? ['--model', turn.model] : []), '-']
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
