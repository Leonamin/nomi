import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openAgentMcp, handleAgentMcp } from './agentMcp'
describe('private per-turn MCP endpoint', () => {
  it('requires the exact live turn secret and loopback host; retired tokens and browser origins are rejected', async () => {
    const controller = new AbortController()
    const mcp = await openAgentMcp([{ name: 'nomi_read', description: 'Read', effect: 'read', schema: z.object({}), run: async () => ({}) }], controller.signal, async () => ({}))
    const request = (url = mcp.url, token = mcp.token, origin?: string) => new Request(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(origin ? { origin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'test', version: '1' }, capabilities: {} } }) })
    expect((await handleAgentMcp(request())).status).toBe(200)
    expect((await handleAgentMcp(request(mcp.url, 'other-turn'))).status).toBe(403)
    expect((await handleAgentMcp(request(mcp.url.replace('127.0.0.1', 'localhost')))).status).toBe(403)
    expect((await handleAgentMcp(request(mcp.url, mcp.token, 'https://untrusted.test'))).status).toBe(403)
    await mcp.close()
    expect((await handleAgentMcp(request())).status).toBe(403)
  })
})
