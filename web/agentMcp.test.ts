import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openAgentMcp, handleAgentMcp } from './agentMcp'
describe('private per-turn MCP endpoint', () => {
  it('requires the exact live turn secret and loopback host; retired tokens and browser origins are rejected', async () => {
    const controller = new AbortController()
    const mcp = await openAgentMcp([{ name: 'nomi_read', description: 'Read', effect: 'read', schema: z.object({}), run: async () => ({}) }], controller.signal, async () => ({}))
    const call = (method: string, id = 1, url = mcp.url, token = mcp.token, origin?: string) => new Request(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(origin ? { origin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params: method === 'initialize' ? { protocolVersion: '2025-06-18', clientInfo: { name: 'test', version: '1' }, capabilities: {} } : {} }) })
    expect((await handleAgentMcp(call('initialize'))).status).toBe(200)
    // 无状态传输禁止跨请求复用：initialize 之后再发 tools/list 必须仍然成功（OpenCode v2 的真实顺序）。
    const listed = await handleAgentMcp(call('tools/list', 2))
    expect(listed.status).toBe(200)
    expect((await listed.json() as { result: { tools: { name: string }[] } }).result.tools.map(tool => tool.name)).toEqual(['nomi_read'])
    expect((await handleAgentMcp(call('initialize', 3, mcp.url, 'other-turn'))).status).toBe(403)
    expect((await handleAgentMcp(call('initialize', 4, mcp.url.replace('127.0.0.1', 'localhost')))).status).toBe(403)
    expect((await handleAgentMcp(call('initialize', 5, mcp.url, mcp.token, 'https://untrusted.test'))).status).toBe(403)
    await mcp.close()
    expect((await handleAgentMcp(call('initialize', 6))).status).toBe(403)
  })
})
