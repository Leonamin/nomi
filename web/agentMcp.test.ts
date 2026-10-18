import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { openAgentMcp, handleAgentMcp } from './agentMcp'
/** Responses are SSE streams; the JSON-RPC answer is the last data frame. */
const rpc = async <T>(response: Response) => JSON.parse((await response.text()).split('\n').filter(line => line.startsWith('data: ')).at(-1)!.slice(6)) as T
describe('private per-turn MCP endpoint', () => {
  it('requires the exact live turn secret and loopback host; retired tokens and browser origins are rejected', async () => {
    const controller = new AbortController()
    const mcp = await openAgentMcp([{ name: 'nomi_read', description: 'Read', approvalSubject: { effect: 'read', effectClass: 'reversible_local', requiresPlanReview: false, destructiveHint: false }, schema: z.object({}), run: async () => ({}) }], controller.signal, async () => ({}))
    const call = (method: string, id = 1, url = mcp.url, token = mcp.token, origin?: string) => new Request(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(origin ? { origin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params: method === 'initialize' ? { protocolVersion: '2025-06-18', clientInfo: { name: 'test', version: '1' }, capabilities: {} } : {} }) })
    expect((await handleAgentMcp(call('initialize'))).status).toBe(200)
    // 无状态传输禁止跨请求复用：initialize 之后再发 tools/list 必须仍然成功（OpenCode v2 的真实顺序）。
    const listed = await handleAgentMcp(call('tools/list', 2))
    expect(listed.status).toBe(200)
    expect((await rpc<{ result: { tools: { name: string }[] } }>(listed)).result.tools.map(tool => tool.name)).toEqual(['nomi_read'])
    expect((await handleAgentMcp(call('initialize', 3, mcp.url, 'other-turn'))).status).toBe(403)
    expect((await handleAgentMcp(call('initialize', 4, mcp.url.replace('127.0.0.1', 'localhost')))).status).toBe(403)
    expect((await handleAgentMcp(call('initialize', 5, mcp.url, mcp.token, 'https://untrusted.test'))).status).toBe(403)
    await mcp.close()
    expect((await handleAgentMcp(call('initialize', 6))).status).toBe(403)
  })
  it('runs the tool with stringified arrays intact so prepareArguments, not the SDK, owns validation', async () => {
    const controller = new AbortController()
    const seen: unknown[] = []
    const tool = { name: 'draft_shots', description: 'Draft', approvalSubject: { effect: 'write', effectClass: 'reversible_local', requiresPlanReview: false, destructiveHint: false }, schema: z.object({ shots: z.array(z.object({ title: z.string() })) }).refine(() => true), run: async () => ({}) } as const
    const mcp = await openAgentMcp([tool as never], controller.signal, async (_tool, input) => { seen.push(input); return { ok: true } })
    const response = await handleAgentMcp(new Request(mcp.url, { method: 'POST', headers: { authorization: `Bearer ${mcp.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'draft_shots', arguments: { shots: '[{"title":"a"}]' } } }) }))
    const body = await rpc<{ result: { isError?: boolean } }>(response)
    expect(body.result.isError).toBeUndefined()
    expect(seen).toEqual([{ shots: '[{"title":"a"}]' }])
    const listed = await handleAgentMcp(new Request(mcp.url, { method: 'POST', headers: { authorization: `Bearer ${mcp.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) }))
    const schema = (await rpc<{ result: { tools: { inputSchema: { properties?: Record<string, { type?: string }> } }[] } }>(listed)).result.tools[0].inputSchema
    expect(schema.properties?.shots?.type).toBe('array')
    await mcp.close()
  })
  it('answers a long tool call with headers before the tool settles, so client header timeouts cannot cut an approval wait', async () => {
    const controller = new AbortController()
    let settle: (value: unknown) => void = () => undefined
    const mcp = await openAgentMcp([{ name: 'generate', description: 'Generate', approvalSubject: { effect: 'write', effectClass: 'reversible_local', requiresPlanReview: false, destructiveHint: false }, schema: z.object({}), run: async () => ({}) }], controller.signal, () => new Promise(resolve => { settle = resolve }))
    const response = await handleAgentMcp(new Request(mcp.url, { method: 'POST', headers: { authorization: `Bearer ${mcp.token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'generate', arguments: {}, _meta: { progressToken: 'p1' } } }) }))
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    settle({ ok: true })
    expect((await rpc<{ result: { content: { text: string }[] } }>(response)).result.content[0].text).toBe('{"ok":true}')
    await mcp.close()
  })
})
