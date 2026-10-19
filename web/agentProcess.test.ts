import { describe, expect, it } from 'vitest'
import { nativeAgentConfig, claudeAgentArgs, parseNativeAgentEvent, nativeAgentExecutable, assertOpenCodeCapabilities, nativeAgentOtherServers, nativeAgentEnvironment, assertNativeSessionScope } from './agentProcess'

describe('native agent transport boundary', () => {
  it('keeps OpenCode v2 native tools and unrelated MCP servers disabled', () => {
    const config = nativeAgentConfig('http://127.0.0.1:9031/agent/mcp/turn', { linear: { type: 'remote', url: 'https://linear.example/mcp', disabled: true }, exa: { type: 'remote', url: 'https://exa.example/mcp', disabled: true } }, ['read_script'])
    expect(config.mcp.servers.linear).toMatchObject({ disabled: true })
    expect(config.permissions).toContainEqual({ action: '*', resource: '*', effect: 'deny' })
    expect(config.permissions).not.toContainEqual({ action: 'execute', resource: '*', effect: 'allow' })
    expect(config.permissions).toContainEqual({ action: 'nomi_read_script', resource: '*', effect: 'allow' })
    expect(config.mcp.servers.nomi).toMatchObject({ type: 'remote', url: 'http://127.0.0.1:9031/agent/mcp/turn' })
  })
  it.each([
    ['opencode', { type: 'text', sessionID: 'native-1', part: { text: 'Connected', id: 'part-1' } }],
    ['codex', { type: 'item.completed', item: { type: 'agent_message', text: 'Connected', id: 'part-1' } }],
  ] as const)('projects the actual %s response instead of fabricating a reply', (engine, event) => {
    expect(parseNativeAgentEvent(engine, event)).toMatchObject({ kind: 'text', text: 'Connected', id: 'part-1' })
  })
  it('preserves provider errors instead of treating a clean CLI exit as success', () => {
    expect(parseNativeAgentEvent('opencode', { type: 'error', error: { code: 'provider.quota', message: 'insufficient credits' } })).toMatchObject({ kind: 'error', text: 'insufficient credits' })
  })
})

describe('native runtime ownership', () => {
  it('resolves native binaries through PATH unless explicitly selected', () => {
    expect(nativeAgentExecutable('codex', {})).toBe('codex')
    expect(nativeAgentExecutable('opencode', {})).toBe('opencode')
    expect(nativeAgentExecutable('opencode', { NOMI_WEB_OPENCODE_BIN: '/isolated/opencode2' })).toBe('/isolated/opencode2')
  })
  it('rejects incompatible versions and absent isolation before execution', () => {
    expect(() => assertOpenCodeCapabilities('1.18.26', '--format json --pure', '--stdio --hostname --port')).toThrow(/OpenCode 2/)
    expect(() => assertOpenCodeCapabilities('opencode v2.0.28', '--format json', '--stdio --hostname --port')).toThrow(/private server/)
    expect(() => assertOpenCodeCapabilities('opencode v3.0.0', '--server --format', '--stdio --hostname --port')).toThrow(/OpenCode 2/)
    expect(() => assertOpenCodeCapabilities('opencode v2.0.28', '--server --format', '--stdio --hostname --port')).not.toThrow()
  })
  it('disables every unrelated server reported by the owning config sources', () => {
    expect(nativeAgentOtherServers([{ type: 'global', info: { mcp: { linear: {type:'remote',url:'https://linear.example/mcp'}, nomi: {} } } }, { type: 'local', info: { mcp: { exa: {type:'local',command:['exa']} } } }])).toEqual({ linear:{type:'remote',url:'https://linear.example/mcp',disabled:true},exa:{type:'local',command:['exa'],disabled:true} })
    expect(() => nativeAgentOtherServers({ mcp: {} })).toThrow(/configuration/)
    expect(nativeAgentOtherServers([{ type: 'directory' }, { info: {} }])).toEqual({})
  })
})

describe('native configuration source shape', () => {
  it.each([
    [{ info: 'bad' }], [{ info: [] }], [{ info: null }], [{ info: false }],
    [{ info: { mcp: [] } }], [{ info: { mcp: 'bad' } }], [{ info: { mcp: null } }], [{ info: { mcp: false } }],
  ])('rejects a present malformed configuration owner instead of enabling undiscovered servers', source => {
    expect(() => nativeAgentOtherServers([source])).toThrow(/configuration/)
  })
})

describe('native private process contract', () => {
  it('pins PWD to the task directory rather than the server repository', () => {
    expect(nativeAgentEnvironment({directory:'/private/task',mcpToken:'test'},{PWD:'/shared/main'}).PWD).toBe('/private/task')
  })
  it('uses typed canonical server overrides and direct tool discovery on resume', () => {
    const other = nativeAgentOtherServers([{info:{mcp:{servers:{figma:{type:'remote',url:'https://mcp.example/mcp'}}}}}])
    const config = nativeAgentConfig('http://localhost/nomi',other,['read_script'])
    expect(config.mcp.servers.figma).toEqual({type:'remote',url:'https://mcp.example/mcp',disabled:true})
    expect(config.mcp.servers.nomi.codemode).toBe(false)
    expect(config.permissions).not.toContainEqual({action:'execute',resource:'*',effect:'allow'})
  })
})

describe('native resume ownership', () => {
  it('preserves a session only within its private execution directory', () => {
    expect(()=>assertNativeSessionScope({data:{id:'ses-1',location:{directory:'/private/task'}}},'ses-1','/private/task')).not.toThrow()
    expect(()=>assertNativeSessionScope({data:{id:'ses-1',location:{directory:'/shared/repository'}}},'ses-1','/private/task')).toThrow(/new conversation/)
    expect(()=>assertNativeSessionScope({data:{id:'other',location:{directory:'/private/task'}}},'ses-1','/private/task')).toThrow(/session/)
  })
})

describe('claude engine', () => {
  // Captured from `claude -p "say hi in 3 words" --output-format stream-json --verbose --tools ""` (2.1.302).
  const init = { type: 'system', subtype: 'init', session_id: '6cddb9bf-5276-42df-9152-6b3af3da0b50', tools: [], mcp_servers: [] }
  const assistant = { type: 'assistant', uuid: '7302dd3e', message: { id: 'msg_1', content: [{ type: 'text', text: 'Hello there, friend!' }], usage: { input_tokens: 2, output_tokens: 6 } }, session_id: 'x' }
  const result = { type: 'result', subtype: 'success', is_error: false, result: 'Hello there, friend!', usage: { input_tokens: 2, cache_creation_input_tokens: 2115, cache_read_input_tokens: 649, output_tokens: 10 } }
  it('projects session, text, thinking, usage and errors from stream-json', () => {
    expect(parseNativeAgentEvent('claude', init)).toEqual({ kind: 'session', id: '6cddb9bf-5276-42df-9152-6b3af3da0b50' })
    expect(parseNativeAgentEvent('claude', assistant)).toEqual({ kind: 'text', id: '7302dd3e:0', text: 'Hello there, friend!' })
    expect(parseNativeAgentEvent('claude', { ...assistant, message: { content: [{ type: 'thinking', thinking: 'hmm' }] } })).toMatchObject({ kind: 'thinking', text: 'hmm' })
    expect(parseNativeAgentEvent('claude', { ...assistant, message: { content: [{ type: 'tool_use', name: 'x' }] } })).toBeUndefined()
    expect(parseNativeAgentEvent('claude', result)).toEqual({ kind: 'usage', input: 2, output: 10, cacheRead: 649 })
    expect(parseNativeAgentEvent('claude', { ...result, is_error: true, result: 'Not logged in' })).toEqual({ kind: 'error', text: 'Not logged in' })
  })
  it('disables built-in tools, admits only Nomi MCP tools and keeps the token out of argv', () => {
    const args = claudeAgentArgs({ model: 'sonnet', sessionId: 's-1', mcpUrl: 'http://127.0.0.1:9031/agent/mcp/t', toolNames: ['read_script', 'generate'] })
    expect(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2)).toEqual(['--tools', ''])
    expect(args).toContain('--strict-mcp-config')
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('mcp__nomi__read_script,mcp__nomi__generate')
    expect(args.slice(args.indexOf('--resume'), args.indexOf('--resume') + 2)).toEqual(['--resume', 's-1'])
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual(['--model', 'sonnet'])
    expect(args.join(' ')).toContain('${NOMI_WEB_AGENT_MCP_TOKEN}')
    expect(() => claudeAgentArgs({ model: '', mcpUrl: 'u', toolNames: ['a b'] })).toThrow()
  })
  it('resolves the binary through NOMI_WEB_CLAUDE_BIN', () => {
    expect(nativeAgentExecutable('claude', {})).toBe('claude')
    expect(nativeAgentExecutable('claude', { NOMI_WEB_CLAUDE_BIN: '/x/claude' })).toBe('/x/claude')
  })
})
