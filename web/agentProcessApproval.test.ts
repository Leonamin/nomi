import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const captured = vi.hoisted(() => ({ args: [] as string[] }))
vi.mock('node:child_process', async () => {
  const { EventEmitter } = await import('node:events')
  const { PassThrough } = await import('node:stream')
  return { spawn: (_file: string, args: string[]) => {
    captured.args = args
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: { end: () => queueMicrotask(() => child.emit('close', 0)) } })
    return child
  } }
})
import { runNativeAgent } from './agentProcess'

describe('Nomi-owned Codex MCP approval', () => {
  it('delegates tool approval only to the scoped Nomi server while retaining the read-only host sandbox', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-codex-approval-'))
    try {
      await runNativeAgent({ engine: 'codex', model: '', prompt: 'Write the approved script', directory, mcpUrl: 'http://127.0.0.1:19032/agent/mcp/turn', mcpToken: 'test', signal: new AbortController().signal, onEvent: () => undefined })
      expect(captured.args).toContain('mcp_servers.nomi.default_tools_approval_mode="approve"')
      expect(captured.args).toContain('sandbox_mode="read-only"')
      expect(captured.args).toContain('shell_tool')
      expect(captured.args).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })
})
