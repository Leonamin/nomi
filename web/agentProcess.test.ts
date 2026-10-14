import { describe, expect, it } from 'vitest'
import { nativeAgentConfig, parseNativeAgentEvent, nativeAgentExecutable, assertOpenCodeCapabilities, nativeAgentOtherServers, nativeAgentEnvironment, assertNativeSessionScope } from './agentProcess'

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
