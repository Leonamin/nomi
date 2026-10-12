import { describe, expect, it } from 'vitest'
import { nativeAgentConfig, parseNativeAgentEvent } from './agentProcess'

describe('native agent transport boundary', () => {
  it('keeps OpenCode v2 native tools and unrelated MCP servers disabled', () => {
    const config = nativeAgentConfig('http://127.0.0.1:9031/agent/mcp/turn', ['linear', 'exa'])
    expect(config.mcp.servers.linear).toEqual({ enabled: false })
    expect(config.permissions).toContainEqual({ action: '*', resource: '*', effect: 'deny' })
    expect(config.mcp.servers.nomi).toMatchObject({ type: 'remote', codemode: false })
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
