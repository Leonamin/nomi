import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const captured = vi.hoisted(() => ({ args: [] as string[], env: {} as NodeJS.ProcessEnv, version: 'opencode v2.0.28', launches: 0, serverArgs: [] as string[], mcpProbes: 0, leasesClosed: 0, stderrDrains: 0, output: [] as unknown[], readiness: {data:[{name:'nomi',status:{status:'connected'}}]} as unknown }))
vi.mock('node:child_process', async () => {
  const { EventEmitter } = await import('node:events')
  const { PassThrough } = await import('node:stream')
  return { execFile: (_file: string, args: string[], _options: unknown, callback: (error: unknown, stdout: string) => void) => {
    if (args[0] === 'api') captured.mcpProbes += 1
    const stdout = args[0] === '--version' ? captured.version : args[0] === 'run' ? '--server --format' : args[0] === 'serve' ? '--stdio --hostname --port' : args[0] === 'api' ? JSON.stringify(captured.readiness) : JSON.stringify([{ type: 'document', info: { mcp: { servers: { linear: { type:'remote',url:'https://linear.example/mcp' }, exa: { type:'local',command:['exa'] } } } } }])
    queueMicrotask(() => callback(null, stdout))
  }, spawn: (_file: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
    captured.args = args
    captured.env = options.env
    if (args[0] === 'serve') captured.serverArgs = args
    else captured.launches += 1
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: { on: () => undefined, end: () => { if (args[0] === 'serve') captured.leasesClosed++; queueMicrotask(() => { if (args[0] !== 'serve') for (const event of captured.output) child.stdout.write(JSON.stringify(event)+'\n'); child.emit('close', 0) }) } } })
    if (args[0] === 'serve') { const resume=child.stderr.resume.bind(child.stderr); child.stderr.resume=()=>{ captured.stderrDrains++; return resume() } }
    if (args[0] === 'serve') queueMicrotask(() => child.stdout.write(JSON.stringify({url:'http://127.0.0.1:19111'})+'\n'))
    return child
  } }
})
import { runNativeAgent } from './agentProcess'

describe('Nomi-owned Codex MCP approval', () => {
  it('delegates tool approval only to the scoped Nomi server while retaining the read-only host sandbox', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-codex-approval-'))
    try {
      await runNativeAgent({ engine: 'codex', model: '', prompt: 'Write the approved script', directory, mcpUrl: 'http://127.0.0.1:19032/agent/mcp/turn', mcpToken: 'test', toolNames: ['read_script'], signal: new AbortController().signal, onEvent: () => undefined })
      expect(captured.args).toContain('mcp_servers.nomi.default_tools_approval_mode="approve"')
      expect(captured.args).toContain('sandbox_mode="read-only"')
      expect(captured.args).toContain('shell_tool')
      expect(captured.args).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })
})

describe('OpenCode isolated launch boundary', () => {
  it('uses runtime source keys and keeps the private server under deny by default', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-opencode-contract-'))
    try {
      await runNativeAgent({ engine: 'opencode', model: 'provider/model', prompt: 'Read script', directory, mcpUrl: 'http://localhost/mcp', mcpToken: 'test', toolNames: ['read_script'], signal: new AbortController().signal, onEvent: () => undefined })
      const config = JSON.parse(captured.env.OPENCODE_CONFIG_CONTENT!)
      expect(config.mcp.servers.linear).toMatchObject({ disabled: true })
      expect(config.mcp.servers.exa).toMatchObject({ disabled: true })
      expect(config.permissions[0]).toEqual({ action: '*', resource: '*', effect: 'deny' })
      expect(captured.args).toContain('--server')
      expect(captured.serverArgs).toEqual(['serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'])
      expect(captured.mcpProbes).toBeGreaterThan(0)
      expect(captured.stderrDrains).toBeGreaterThan(0)
      expect(captured.leasesClosed).toBeGreaterThan(0)
      expect(captured.args).not.toContain('--auto')
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })
  it('never starts a provider turn for an unsupported installed runtime', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-opencode-reject-'))
    const before = captured.launches
    captured.version = '1.18.26'
    try {
      await expect(runNativeAgent({ engine: 'opencode', model: 'provider/model', prompt: 'Read script', directory, mcpUrl: 'http://localhost/mcp', mcpToken: 'test', toolNames: ['read_script'], signal: new AbortController().signal, onEvent: () => undefined })).rejects.toThrow(/OpenCode 2/)
      expect(captured.launches).toBe(before)
    } finally { captured.version = 'opencode v2.0.28'; fs.rmSync(directory, { recursive: true, force: true }) }
  })
})

describe('private OpenCode discovery fails closed', () => {
  it.each([{}, {data:[{name:'figma',status:{status:'connected'}}]}, {data:[{name:'nomi',status:{status:'failed'}}]}])('disposes the owned lease before any provider launch on invalid readiness', async readiness => {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-opencode-readiness-'))
    const before=captured.launches;const closed=captured.leasesClosed;captured.readiness=readiness
    try {
      await expect(runNativeAgent({engine:'opencode',model:'provider/model',prompt:'Read script',directory,mcpUrl:'http://localhost/mcp',mcpToken:'test',toolNames:['read_script'],signal:new AbortController().signal,onEvent:()=>undefined})).rejects.toThrow(/readiness|unrelated|discovery/)
      expect(captured.launches).toBe(before);expect(captured.leasesClosed).toBe(closed+1)
    }finally{captured.readiness={data:[{name:'nomi',status:{status:'connected'}}]};fs.rmSync(directory,{recursive:true,force:true})}
  })
})

describe('private discovery interruption and deadline', () => {
  it('times out pending discovery and closes the lease without invoking the provider', async () => {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-opencode-pending-'))
    const before=captured.launches;const closed=captured.leasesClosed;captured.readiness={data:[{name:'nomi',status:{status:'pending'}}]}
    vi.useFakeTimers()
    try {
      const turn=runNativeAgent({engine:'opencode',model:'provider/model',prompt:'Read script',directory,mcpUrl:'http://localhost/mcp',mcpToken:'test',toolNames:['read_script'],signal:new AbortController().signal,onEvent:()=>undefined})
      const rejected=expect(turn).rejects.toThrow(/did not settle/)
      await vi.advanceTimersByTimeAsync(31_000)
      await rejected
      expect(captured.launches).toBe(before);expect(captured.leasesClosed).toBe(closed+1)
    }finally{vi.useRealTimers();captured.readiness={data:[{name:'nomi',status:{status:'connected'}}]};fs.rmSync(directory,{recursive:true,force:true})}
  })
  it('aborts pending discovery and closes only its lease before invoking the provider', async () => {
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-opencode-abort-'))
    const before=captured.launches;const closed=captured.leasesClosed;const probes=captured.mcpProbes
    captured.readiness={data:[{name:'nomi',status:{status:'pending'}}]};const controller=new AbortController()
    try {
      const turn=runNativeAgent({engine:'opencode',model:'provider/model',prompt:'Read script',directory,mcpUrl:'http://localhost/mcp',mcpToken:'test',toolNames:['read_script'],signal:controller.signal,onEvent:()=>undefined})
      const rejected=expect(turn).rejects.toThrow(/abort|stopped/i)
      await vi.waitFor(()=>expect(captured.mcpProbes).toBeGreaterThan(probes))
      controller.abort();await rejected
      expect(captured.launches).toBe(before);expect(captured.leasesClosed).toBe(closed+1)
    }finally{captured.readiness={data:[{name:'nomi',status:{status:'connected'}}]};fs.rmSync(directory,{recursive:true,force:true})}
  })
})


describe('native calls cannot masquerade as completed prose', () => {
  it.each(['opencode', 'codex'].flatMap(engine => ['<｜｜DSML｜｜ calls> <｜｜DSML｜｜ invoke name="nomi_write_script">draft', '<function_calls><invoke name="write_script">draft', '<tool_call>{"name":"write_script"}'].map(text => ({engine:engine as 'opencode' | 'codex',text}))))('rejects protocol text split across $engine events without executing or displaying it', async ({engine,text}) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-protocol-text-'))
    const events: unknown[] = []
    const chunks = [text.slice(0, 6), text.slice(6)]
    captured.output = chunks.map((text, i) => engine === 'opencode' ? {type:'text',part:{id:String(i),text}} : {type:'item.completed',item:{id:String(i),type:'agent_message',text}})
    try {
      await expect(runNativeAgent({engine, model:'provider/model', prompt:'Update document',directory,mcpUrl:'http://localhost/mcp',mcpToken:'test',toolNames:['write_script'],signal:new AbortController().signal,onEvent:event=>events.push(event)})).rejects.toThrow('agent_tool_call_not_executed')
      expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({kind:'text'})]))
    } finally { captured.output=[]; fs.rmSync(directory,{recursive:true,force:true}) }
  })
})


it('preserves ordinary explanations quoting tool syntax and legitimate multi-part replies', async () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-prose-'))
  captured.output=[{type:'text',part:{id:'one',text:'The literal `<tool_call>` in your message is text. '}},{type:'text',part:{id:'two',text:'No document was changed.'}}]
  const events: unknown[]=[]
  try {
    await runNativeAgent({engine:'opencode',model:'provider/model',prompt:'Explain',directory,mcpUrl:'http://localhost/mcp',mcpToken:'test',toolNames:[],signal:new AbortController().signal,onEvent:e=>events.push(e)})
    expect(events).toEqual([{kind:'text',id:'one',text:'The literal `<tool_call>` in your message is text. '},{kind:'text',id:'two',text:'No document was changed.'}])
  }finally{captured.output=[];fs.rmSync(directory,{recursive:true,force:true})}
})
