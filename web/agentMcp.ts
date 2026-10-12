import { randomBytes, randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { AgentTool } from './agentTools'

type TurnScope = { token: string; server: McpServer; transport: WebStandardStreamableHTTPServerTransport; signal: AbortSignal }
const scopes = new Map<string, TurnScope>()
/** Standard MCP transport; an ephemeral secret binds every request to one admitted turn. */
export async function openAgentMcp(tools: AgentTool[], signal: AbortSignal, execute: (tool: AgentTool, input: unknown) => Promise<unknown>) {
  const id = randomUUID(); const token = randomBytes(32).toString('hex')
  const server = new McpServer({ name: 'Nomi Web', version: '0.23.1' })
  for (const tool of tools) server.registerTool(tool.name, { description: tool.description, inputSchema: tool.schema.shape, annotations: { readOnlyHint: tool.effect === 'read', destructiveHint: false } }, async (input: Record<string, unknown>) => {
    try {
      signal.throwIfAborted()
      const output = await execute(tool, input)
      return { content: [{ type: 'text' as const, text: JSON.stringify(output).slice(0, 50000) }] }
    } catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }] } }
  })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  scopes.set(id, { token, server, transport, signal })
  return { url: `http://127.0.0.1:${process.env.NOMI_WEB_PORT || 9031}/agent/mcp/${id}`, token, close: async () => { scopes.delete(id); await server.close() } }
}
export async function handleAgentMcp(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const scope = scopes.get(url.pathname.split('/').at(-1) || '')
  if (!scope || scope.signal.aborted || request.headers.get('authorization') !== `Bearer ${scope.token}` || url.host !== `127.0.0.1:${process.env.NOMI_WEB_PORT || 9031}` || request.headers.has('origin')) return new Response('Unauthorized', { status: 403 })
  return scope.transport.handleRequest(request)
}
