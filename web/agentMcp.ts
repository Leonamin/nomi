import { randomBytes, randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { AgentTool } from './agentTools'

type Execute = (tool: AgentTool, input: unknown) => Promise<unknown>
type TurnScope = { token: string; tools: AgentTool[]; execute: Execute; signal: AbortSignal }
const scopes = new Map<string, TurnScope>()
const port = () => process.env.NOMI_WEB_PORT || 9031

/**
 * 每个请求一个 server + transport。SDK 的无状态传输**禁止跨请求复用**——复用会在第二个请求上回
 * `{"ok":false,"error":"Stateless transport cannot be reused across requests."}`（HTTP 422）。
 * OpenCode v2 在 `initialize` 之后还要发 `tools/list`，所以复用等于工具永远进不了模型
 * （2026-10-13 真机实测：模型只能把工具语法当文本瞎编，`<｜｜DSML｜｜ invoke name="nomi_get_project">`）。
 */
function createServer(scope: TurnScope): McpServer {
  const server = new McpServer({ name: 'Nomi Web', version: '0.23.1' })
  for (const tool of scope.tools) server.registerTool(tool.name, { description: tool.description, inputSchema: tool.schema.shape, annotations: { readOnlyHint: tool.effect === 'read', destructiveHint: false } }, async (input: Record<string, unknown>) => {
    try {
      scope.signal.throwIfAborted()
      const output = await scope.execute(tool, input)
      return { content: [{ type: 'text' as const, text: JSON.stringify(output).slice(0, 50000) }] }
    } catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }] } }
  })
  return server
}

/** Standard MCP transport; an ephemeral secret binds every request to one admitted turn. */
export async function openAgentMcp(tools: AgentTool[], signal: AbortSignal, execute: Execute) {
  const id = randomUUID(); const token = randomBytes(32).toString('hex')
  scopes.set(id, { token, tools, execute, signal })
  return { url: `http://127.0.0.1:${port()}/agent/mcp/${id}`, token, close: async () => { scopes.delete(id) } }
}

export async function handleAgentMcp(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const scope = scopes.get(url.pathname.split('/').at(-1) || '')
  if (!scope || scope.signal.aborted || request.headers.get('authorization') !== `Bearer ${scope.token}` || url.host !== `127.0.0.1:${port()}` || request.headers.has('origin')) return new Response('Unauthorized', { status: 403 })
  const server = createServer(scope)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    const response = await transport.handleRequest(request)
    // GET 是长驻 SSE 流，不能立刻关掉；POST（JSON 响应）处理完即回收。
    if (request.method !== 'GET') await server.close()
    return response
  } catch (error) {
    await server.close().catch(() => undefined)
    throw error
  }
}
