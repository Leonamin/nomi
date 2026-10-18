import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import { randomBytes } from 'node:crypto'
import type { WebAgentEngine } from '../electron/shared/webAgentContracts'

export type NativeAgentEvent =
  | { kind: 'session'; id: string }
  | { kind: 'text' | 'thinking'; id: string; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'usage'; input: number; output: number; cacheRead: number }

type DisabledNativeMcpServer = { type: 'remote'; url: string; disabled: true } | { type: 'local'; command: string[]; disabled: true }

/** Use the owning v2 schema. Direct MCP avoids persisted Code Mode catalog revocations on resume. */
export function nativeAgentConfig(url: string, otherServers: Record<string, DisabledNativeMcpServer>, toolNames: readonly string[]) {
  if (toolNames.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) throw new Error('Unsupported admitted Nomi tool name')
  const permissions = [{ action: '*', resource: '*', effect: 'deny' }, ...toolNames.flatMap(name => [{ action: name, resource: '*', effect: 'allow' }, { action: `nomi_${name}`, resource: '*', effect: 'allow' }])]
  return {
    permissions,
    default_agent: 'nomi',
    agents: { nomi: { description: 'Nomi personal video assistant', mode: 'primary', permissions, system: 'Use only Nomi MCP tools. Do not access files, shell, web or other agents. Never regenerate, select candidates or change the timeline without the user requesting it.' } },
    mcp: { servers: {
      ...otherServers,
      nomi: { type: 'remote', url, codemode: false, oauth: false, timeout: { catalog: 1800000, execution: 1800000 }, headers: { Authorization: 'Bearer {env:NOMI_WEB_AGENT_MCP_TOKEN}' } },
    } },
  }
}

/**
 * Claude Code CLI: built-in tools off (`--tools ""`), only the admitted Nomi MCP tools allowed, settings files ignored.
 * The bearer token never enters argv: the config references `${NOMI_WEB_AGENT_MCP_TOKEN}`, which the CLI expands from env.
 */
export function claudeAgentArgs(turn: Pick<NativeAgentTurn, 'model' | 'sessionId' | 'mcpUrl' | 'toolNames'>): string[] {
  if (turn.toolNames.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) throw new Error('Unsupported admitted Nomi tool name')
  const mcp = { mcpServers: { nomi: { type: 'http', url: turn.mcpUrl, headers: { Authorization: 'Bearer ${NOMI_WEB_AGENT_MCP_TOKEN}' } } } }
  return ['-p', '--output-format', 'stream-json', '--verbose', '--tools', '', '--setting-sources', '', '--permission-mode', 'dontAsk', '--strict-mcp-config', '--mcp-config', JSON.stringify(mcp),
    ...(turn.toolNames.length ? ['--allowedTools', turn.toolNames.map(name => `mcp__nomi__${name}`).join(',')] : []),
    ...(turn.sessionId ? ['--resume', turn.sessionId] : []), ...(turn.model ? ['--model', turn.model] : [])]
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
  } else if (engine === 'claude') {
    if (raw.type === 'system' && raw.subtype === 'init' && typeof raw.session_id === 'string') return { kind: 'session', id: raw.session_id }
    // One assistant event may carry several content blocks; the first usable block is the event's projection.
    if (raw.type === 'assistant') {
      const message = record(raw.message)
      const blocks = Array.isArray(message.content) ? message.content.map(record) : []
      const index = blocks.findIndex(block => (block.type === 'text' && typeof block.text === 'string' && block.text) || (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking))
      if (index >= 0) { const block = blocks[index]; const id = `${String(raw.uuid ?? message.id ?? '')}:${index}`; return block.type === 'text' ? { kind: 'text', id, text: String(block.text) } : { kind: 'thinking', id, text: String(block.thinking) } }
    }
    if (raw.type === 'result') {
      if (raw.is_error === true) return { kind: 'error', text: String(raw.result || raw.subtype || 'Claude turn failed') }
      const usage = record(raw.usage); return { kind: 'usage', input: count(usage.input_tokens), output: count(usage.output_tokens), cacheRead: count(usage.cache_read_input_tokens) }
    }
  } else {
    if (raw.type === 'thread.started' && typeof raw.thread_id === 'string') return { kind: 'session', id: raw.thread_id }
    if (raw.type === 'item.completed' && item.type === 'agent_message' && typeof item.id === 'string' && typeof item.text === 'string') return { kind: 'text', id: item.id, text: item.text }
    if (raw.type === 'turn.failed') return { kind: 'error', text: String(error.message || 'Codex turn failed') }
    if (raw.type === 'turn.completed' && raw.usage) { const usage = record(raw.usage); return { kind: 'usage', input: count(usage.input_tokens), output: count(usage.output_tokens), cacheRead: count(usage.cached_input_tokens) } }
  }
}

/** Installation ownership stays with PATH or an explicit runtime selection. */
export function nativeAgentExecutable(engine: WebAgentEngine, env: NodeJS.ProcessEnv = process.env): string {
  return ({ opencode: env.NOMI_WEB_OPENCODE_BIN, codex: env.NOMI_WEB_CODEX_BIN, claude: env.NOMI_WEB_CLAUDE_BIN })[engine] || engine
}

/** Version and advertised CLI isolation must agree before a tool-bearing turn. */
export function assertOpenCodeCapabilities(version: string, runHelp: string, serveHelp: string): void {
  if (!/^(?:opencode\s+v?)?2\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version.trim())) {
    throw new Error('Nomi requires OpenCode 2 with authenticated private server execution. Select a supported installation with NOMI_WEB_OPENCODE_BIN.')
  }
  if (!/--server\b/.test(runHelp) || !/--format\b/.test(runHelp) || !/--stdio\b/.test(serveHelp) || !/--hostname\b/.test(serveHelp) || !/--port\b/.test(serveHelp)) {
    throw new Error('OpenCode does not advertise the required private server JSON execution capabilities.')
  }
}

/** OpenCode 2 reports configuration sources, including effective global/ancestor keys. */
export function nativeAgentOtherServers(value: unknown): Record<string, DisabledNativeMcpServer> {
  const unsupported = () => new Error('OpenCode returned an unsupported configuration sources contract.')
  const isRecord = (input: unknown): input is Record<string, unknown> => !!input && typeof input === 'object' && !Array.isArray(input)
  if (!Array.isArray(value) || value.some(source => !isRecord(source))) throw unsupported()
  const servers: Record<string, DisabledNativeMcpServer> = {}
  const disable = (name: string, value: unknown) => {
    if (name === 'nomi') return
    if (!isRecord(value)) throw unsupported()
    if (value.type === 'remote' && typeof value.url === 'string') servers[name] = { type: 'remote', url: value.url, disabled: true }
    else if (value.type === 'local' && Array.isArray(value.command) && value.command.every(part => typeof part === 'string')) servers[name] = { type: 'local', command: value.command, disabled: true }
    else throw unsupported()
  }
  for (const source of value) {
    if (!Object.hasOwn(source, 'info')) continue
    const info: unknown = source.info
    if (!isRecord(info)) throw unsupported()
    if (!Object.hasOwn(info, 'mcp')) continue
    if (!isRecord(info.mcp)) throw unsupported()
    for (const [name, server] of Object.entries(info.mcp)) {
      // The owner accepts direct legacy entries and canonical v2 server maps in existing settings.
      if (name === 'servers' && isRecord(server) && !Object.hasOwn(server, 'type')) {
        for (const [nestedName, nestedServer] of Object.entries(server)) disable(nestedName, nestedServer)
      } else if (name === 'timeout' && isRecord(server) && !Object.hasOwn(server, 'type')) continue
      else disable(name, server)
    }
  }
  return servers
}

export function nativeAgentEnvironment(turn: Pick<NativeAgentTurn, 'directory' | 'mcpToken'>, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  // OpenCode chooses PWD before process.cwd(). Pin both to the private task directory.
  return { ...env, PWD: path.resolve(turn.directory), NOMI_WEB_AGENT_MCP_TOKEN: turn.mcpToken }
}

async function probeNativeAgent(executable: string, args: string[], signal: AbortSignal, directory: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd: directory, env, signal, timeout: 10_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      // Config output may contain provider secrets. Never include stdout/stderr in errors.
      if (error) reject(new Error(signal.aborted ? 'Agent stopped by the user' : `Native runtime capability probe failed (${args.slice(0, 2).join(' ')}).`))
      else resolve(stdout)
    })
  })
}

export function assertNativeSessionScope(value: unknown, sessionId: string, directory: string): void {
  const session = record(record(value).data)
  const nativeDirectory = record(session.location).directory
  if (session.id !== sessionId || typeof nativeDirectory !== 'string') throw new Error('OpenCode returned an unsupported native session identity.')
  const realDirectory = (value: string) => fs.existsSync(value) ? fs.realpathSync(value) : path.resolve(value)
  if (realDirectory(nativeDirectory) !== realDirectory(directory)) {
    throw new Error('This native session was created outside its private execution directory. Start a new conversation; the original conversation history is preserved.')
  }
}

async function startOpenCodeServer(executable: string, turn: NativeAgentTurn, env: NodeJS.ProcessEnv) {
  const leasePassword = randomBytes(32).toString('base64url')
  Object.assign(env, { OPENCODE_PASSWORD: leasePassword, OPENCODE_SERVER_PASSWORD: leasePassword })
  const server = spawn(executable, ['serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'], { cwd: turn.directory, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
  server.stderr.resume()
  server.stdin.on('error', () => undefined) // Shutdown may race a terminated lease.
  const lines = readline.createInterface({ input: server.stdout })
  let hasExited = false
  const exited = new Promise<void>(resolve => { server.once('close', () => { hasExited = true; resolve() }) })
  const stop = () => { try { process.kill(-server.pid!, 'SIGTERM') } catch { /* owned process already exited */ } }
  const dispose = async () => {
    turn.signal.removeEventListener('abort', stop)
    lines.close(); server.stdin.end(); stop()
    if (!hasExited) {
      const timer = setTimeout(() => { try { process.kill(-server.pid!, 'SIGKILL') } catch { /* already exited */ } }, 1000)
      timer.unref?.()
      await exited.finally(() => clearTimeout(timer))
    }
  }
  turn.signal.addEventListener('abort', stop, { once: true })
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('OpenCode private server did not become ready.')), 10_000)
      const onError = () => finish(new Error('OpenCode private server failed to start.'))
      const onClose = () => finish(new Error(turn.signal.aborted ? 'Agent stopped by the user' : 'OpenCode private server stopped before readiness.'))
      const onLine = (line: string) => {
        try {
          const value = JSON.parse(line)
          const parsed = new URL(value.url)
          if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port || parsed.username || parsed.password) throw new Error('Invalid private endpoint')
          finish(undefined, parsed.origin)
        } catch { finish(new Error('OpenCode returned an unsupported private server lease.')) }
      }
      const finish = (error?: Error, value?: string) => {
        clearTimeout(timer); lines.off('line', onLine); server.off('error', onError); server.off('close', onClose)
        if (error) reject(error); else resolve(value!)
      }
      lines.on('line', onLine); server.once('error', onError); server.once('close', onClose)
      if (turn.signal.aborted) { stop(); onClose() }
    })
    if (turn.sessionId) {
      const session = JSON.parse(await probeNativeAgent(executable, ['api', '--server', url, 'session.get', '--param', `sessionID=${turn.sessionId}`], turn.signal, turn.directory, env))
      assertNativeSessionScope(session, turn.sessionId, turn.directory)
    }
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      turn.signal.throwIfAborted()
      const status = record(JSON.parse(await probeNativeAgent(executable, ['api', '--server', url, 'mcp.list'], turn.signal, turn.directory, env)))
      if (!Array.isArray(status.data)) throw new Error('OpenCode returned an unsupported MCP readiness contract.')
      const servers = status.data.map(record)
      if (servers.some(server => server.name !== 'nomi' && record(server.status).status !== 'disabled')) throw new Error('OpenCode exposed an unrelated MCP server in this private turn.')
      const nomi = servers.find(server => server.name === 'nomi')
      if (record(nomi?.status).status === 'connected') return { url, dispose }
      if (nomi && record(nomi.status).status !== 'pending') throw new Error('Nomi MCP discovery failed before native execution.')
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    throw new Error('Nomi MCP discovery did not settle before native execution.')
  } catch (error) { await dispose(); throw error }
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
 * · Claude: 목록 서브커맨드가 없다. 별칭(sonnet/opus/…)은 CLI가 해석하므로 비워 두면 CLI 기본값.
 */
export async function listNativeAgentModels(engine: WebAgentEngine, signal: AbortSignal): Promise<string[]> {
  if (engine === 'claude') return []
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
  mcpUrl: string; mcpToken: string; toolNames: readonly string[]; signal: AbortSignal; onEvent: (event: NativeAgentEvent) => void
}
export async function runNativeAgent(turn: NativeAgentTurn): Promise<void> {
  const env = nativeAgentEnvironment(turn)
  // Existing user authentication stays in its owning installation. No token files are copied.
  const executable = nativeAgentExecutable(turn.engine)
  let args: string[]
  let privateServer: Awaited<ReturnType<typeof startOpenCodeServer>> | undefined
  if (turn.engine === 'opencode') {
    fs.mkdirSync(turn.directory, { recursive: true, mode: 0o700 })
    // These controls apply to probes and to the private execution server.
    Object.assign(env, { OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_CONFIG_PROJECT_DISABLE: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true' })
    const version = await probeNativeAgent(executable, ['--version'], turn.signal, turn.directory, env)
    const runHelp = await probeNativeAgent(executable, ['run', '--help'], turn.signal, turn.directory, env)
    const serveHelp = await probeNativeAgent(executable, ['serve', '--help'], turn.signal, turn.directory, env)
    assertOpenCodeCapabilities(version, runHelp, serveHelp)
    const sources = await probeNativeAgent(executable, ['debug', 'config'], turn.signal, turn.directory, env)
    let otherServers: Record<string, DisabledNativeMcpServer>
    try { otherServers = nativeAgentOtherServers(JSON.parse(sources)) }
    catch { throw new Error('OpenCode returned an unsupported configuration sources contract.') }
    Object.assign(env, { OPENCODE_CONFIG_CONTENT: JSON.stringify(nativeAgentConfig(turn.mcpUrl, otherServers, turn.toolNames)) })
    privateServer = await startOpenCodeServer(executable, turn, env)
    args = ['run', '--server', privateServer.url, '--format', 'json', '--model', turn.model, ...(turn.sessionId ? ['--session', turn.sessionId] : []), turn.prompt]
  } else if (turn.engine === 'claude') {
    args = claudeAgentArgs(turn)
  } else {
    args = ['exec', ...(turn.sessionId ? ['resume', turn.sessionId] : []), '--json', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--disable', 'shell_tool', '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '--disable', 'multi_agent', '-c', 'web_search="disabled"', '-c', 'sandbox_mode="read-only"', '-c', `mcp_servers.nomi.url=${JSON.stringify(turn.mcpUrl)}`, '-c', 'mcp_servers.nomi.bearer_token_env_var="NOMI_WEB_AGENT_MCP_TOKEN"', '-c', 'mcp_servers.nomi.tool_timeout_sec=1800', '-c', 'mcp_servers.nomi.default_tools_approval_mode="approve"', ...(turn.model ? ['--model', turn.model] : []), '-']
  }
  fs.mkdirSync(turn.directory, { recursive: true, mode: 0o700 })
  const child = spawn(executable, args, { cwd: turn.directory, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
  if (turn.engine !== 'opencode') child.stdin.end(turn.prompt)
  else child.stdin.end()
  let diagnostic = ''
  let hasProviderError = false
  const assistantText: Extract<NativeAgentEvent, { kind: 'text' | 'thinking' }>[] = []
  const lines = readline.createInterface({ input: child.stdout })
  lines.on('line', line => {
    try {
      const raw = JSON.parse(line)
      if (turn.engine === 'opencode' && typeof raw.sessionID === 'string') turn.onEvent({ kind: 'session', id: raw.sessionID })
      const event = parseNativeAgentEvent(turn.engine, raw)
      if (event) {
        if (event.kind === 'text') assistantText.push(event)
        else { if (event.kind === 'error') hasProviderError = true; turn.onEvent(event) }
      }
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
    // Text is never a tool transport. Validate the completed response, including
    // markers split across events, before publishing it as ordinary assistant prose.
    const text = assistantText.map(event => event.text).join('')
    if (/^\s*(?:<｜｜DSML｜｜\s*(?:calls|invoke)\b|<function_calls\b|<tool_call\b)/u.test(text)) {
      throw new Error('agent_tool_call_not_executed')
    }
    for (const event of assistantText) turn.onEvent(event)
  } finally { turn.signal.removeEventListener('abort', stop); lines.close(); stop(); await privateServer?.dispose() }
}
