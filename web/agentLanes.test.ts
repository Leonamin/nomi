import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { LaneWorkspaceProjection } from '../electron/shared/agentLane/laneContracts'
import { hostEvents } from './runtimeHost'
import { createProject } from '../electron/projects/repository'
import { createWebSurface as createSurface } from './surface'
import type { NativeAgentTurn } from './agentProcess'
const mcp = vi.hoisted(() => ({ execute: undefined as undefined | ((tool: import('./agentTools').AgentTool, input: unknown) => Promise<unknown>) }))
vi.mock('./agentMcp', () => ({ openAgentMcp: async (_tools: unknown, _signal: unknown, execute: typeof mcp.execute) => { mcp.execute = execute; return { url: 'http://localhost/mcp', token: 'test', close: async () => undefined } } }))
import { WebAgentLanes } from './agentLanes'
async function fixture() {
  process.env.NOMI_WEB_OPENCODE_MODEL = 'opencode-go/installed-model'
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-agent-lanes-'))
  let finish: () => void = () => undefined
  const run = vi.fn((_turn: NativeAgentTurn) => new Promise<void>(resolve => { finish = resolve }))
  const lanes = new WebAgentLanes(root, run, async () => ({ tools: [], dispose: () => undefined }))
  const project = createProject({ name: 'Agent lane identity' })
  const surface = createSurface('http://localhost')
  const suspension = surface.suspend({ surfaceInstanceId: crypto.randomUUID() }).value.suspension
  const surfaceBinding = (await surface.commit({ projectId: project.id, suspension })).value.binding
  const selected = surface.registry.getCommittedProjectSelection()!
  const binding = { projectId: selected.projectId, immutableProjectUuid: selected.immutableProjectUuid, projectGeneration: selected.projectGeneration }
  let projection: LaneWorkspaceProjection | undefined
  const listener = (event: { payload: LaneWorkspaceProjection; targetSurfaceId?: number }) => { if (event.targetSurfaceId === surface.id) projection = JSON.parse(JSON.stringify(event.payload)) }
  hostEvents.on('message', listener)
  return { lanes, surface, surfaceBinding, binding, root, run, finish: () => finish(), projection: () => projection!, dispose: () => hostEvents.off('message', listener) }
}
describe('native web lanes keep execution separate from browser subscriptions', () => {
  it('executes creation planners in an isolated tool-free request without opening or borrowing a lane', async () => {
    const f = await fixture()
    try {
      const result = f.lanes.send(f.surface, { kind: 'single-shot', requestId: 'single-shot-plan-1', projectId: f.binding.projectId, featureKey: 'storyboard', prompt: 'Return a two-shot plan', context: { approvalPolicy: { mode: 'step', spend: 'confirm' }, systemPrompt: 'Return only storyboard JSON' } })
      await vi.waitFor(() => expect(f.run).toHaveBeenCalledOnce())
      const turn = f.run.mock.calls[0][0]
      expect(turn.mcpUrl).toBe('http://localhost/mcp')
      expect(turn.sessionId).toBeUndefined()
      expect(turn.prompt).toContain('Return only storyboard JSON')
      turn.onEvent({ kind: 'text', id: 'actual-provider-part', text: '{"shots":[1,2]}' })
      f.finish()
      await expect(result).resolves.toMatchObject({ ok: true, singleShot: { running: false, parts: [{ kind: 'assistant-text', text: '{"shots":[1,2]}' }] } })
      expect(f.projection()).toBeUndefined()
    } finally { f.finish(); f.dispose() }
  })
  it('rejects a creation request addressed to another project before executing', async () => {
    const f = await fixture()
    try {
      expect((await f.lanes.send(f.surface, { kind: 'single-shot', requestId: 'single-shot-plan-2', projectId: 'wrong-project', featureKey: 'direction', prompt: 'Draft', context: { approvalPolicy: { mode: 'step', spend: 'confirm' } } })).ok).toBe(false)
      expect(f.run).not.toHaveBeenCalled()
    } finally { f.dispose() }
  })
  it('releases its subscription after project authority was released by the home action', async () => {
    const f = await fixture()
    try {
      const opened = await f.lanes.send(f.surface, { kind: 'workspace-open', binding: f.binding })
      if (!opened.ok) throw new Error('Workspace not opened')
      f.surface.release({ authority: f.surfaceBinding })
      expect(await f.lanes.send(f.surface, { kind: 'workspace-close', workspaceId: opened.workspaceId })).toEqual({ ok: true })
    } finally { f.dispose() }
  })
  it.each(['openai', 'custom-relay'])('uses the saved OpenCode favorite for %s without forcing a provider', async providerID => {
    const f = await fixture()
    const home = path.join(f.root, 'native-home')
    const directory = path.join(home, '.local/state/opencode')
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'model.json'), JSON.stringify({ favorite: [{ providerID, modelID: 'my-model' }], recent: [{ providerID: 'opencode-go', modelID: 'other-model' }] }))
    const spy = vi.spyOn(os, 'homedir').mockReturnValue(home)
    delete process.env.NOMI_WEB_OPENCODE_MODEL
    try { expect(f.lanes.settings(f.surface)).toMatchObject({ engine: 'opencode', model: `${providerID}/my-model` }) }
    finally { spy.mockRestore(); f.dispose() }
  })
  it('retains a running turn when a view closes and restores its actual transcript after reconnect', async () => {
    const f = await fixture(); const binding = f.binding
    try {
      const opened = await f.lanes.send(f.surface, { kind: 'workspace-open', binding })
      expect(opened.ok).toBe(true)
      const workspaceId = opened.ok ? opened.workspaceId : undefined
      expect(await f.lanes.send(f.surface, { kind: 'prompt', text: 'Read my project', workspaceId })).toEqual({ ok: true })
      await vi.waitFor(() => expect(f.run).toHaveBeenCalledOnce())
      await f.lanes.send(f.surface, { kind: 'workspace-close', workspaceId })
      expect(f.run.mock.calls[0][0]?.signal?.aborted).not.toBe(true)
      await f.lanes.send(f.surface, { kind: 'workspace-open', binding })
      expect(f.projection().active).toMatchObject({ running: true, parts: [{ kind: 'user', text: 'Read my project' }] })
      f.finish()
      await vi.waitFor(() => expect(f.projection().active.running).toBe(false))
      const restored = new WebAgentLanes(f.root, f.run)
      await restored.send(f.surface, { kind: 'workspace-open', binding })
      expect(f.projection().active.parts[0]).toMatchObject({ kind: 'user', text: 'Read my project' })
    } finally { f.finish(); f.dispose() }
  })
  it('closes only its captured view after the project surface has been released, without stopping execution', async () => {
    const f = await fixture()
    try {
      const opened = await f.lanes.send(f.surface, { kind: 'workspace-open', binding: f.binding })
      const workspaceId = opened.ok ? opened.workspaceId : undefined
      await f.lanes.send(f.surface, { kind: 'prompt', text: 'Keep accepted work running', workspaceId })
      await vi.waitFor(() => expect(f.run).toHaveBeenCalledOnce())
      const unselected = { ...f.surface, registry: { getCommittedProjectSelection: () => undefined } } as typeof f.surface
      expect((await f.lanes.send({ ...unselected, id: f.surface.id + 1 }, { kind: 'workspace-close', workspaceId })).ok).toBe(false)
      expect(await f.lanes.send(unselected, { kind: 'workspace-close', workspaceId })).toEqual({ ok: true })
      expect(f.run.mock.calls[0][0].signal.aborted).toBe(false)
    } finally { f.finish(); f.dispose() }
  })
  it('rejects a replacement browser or stale conversation selector before invoking either engine', async () => {
    const f = await fixture(); const binding = f.binding
    try {
      const opened = await f.lanes.send(f.surface, { kind: 'workspace-open', binding })
      const workspaceId = opened.ok ? opened.workspaceId : undefined
      expect((await f.lanes.send({ ...f.surface, id: 43 }, { kind: 'prompt', text: 'Wrong view', workspaceId })).ok).toBe(false)
      expect((await f.lanes.send(f.surface, { kind: 'prompt', text: 'Wrong conversation', workspaceId, expectedSessionId: 'obsolete' })).ok).toBe(false)
      expect(f.run).not.toHaveBeenCalled()
    } finally { f.dispose() }
  })
  it('serializes parallel MCP approvals so one response cannot retire another call', async () => {
    const f = await fixture(); const binding = f.binding
    try {
      const opened = await f.lanes.send(f.surface, { kind: 'workspace-open', binding })
      const workspaceId = opened.ok ? opened.workspaceId : undefined
      await f.lanes.send(f.surface, { kind: 'prompt', text: 'Generate requested shots', workspaceId })
      await vi.waitFor(() => expect(f.run).toHaveBeenCalledOnce())
      const tool = (name: string) => ({ name, approvalSubject: { effect: 'paid', effectClass: 'spend', requiresPlanReview: false, destructiveHint: true }, schema: { parse: (input: unknown) => input }, run: async () => ({ taskId: name }) })
      const first = mcp.execute!(tool('first'), {})
      await vi.waitFor(() => expect(f.projection().active.pending?.toolName).toBe('first'))
      const firstId = f.projection().active.pending!.toolCallId
      const second = mcp.execute!(tool('second'), {})
      await Promise.resolve()
      expect(f.projection().active.pending?.toolCallId).toBe(firstId)
      await f.lanes.send(f.surface, { kind: 'approval', workspaceId, toolCallId: firstId, action: 'allow-once' })
      await expect(first).resolves.toEqual({ taskId: 'first' })
      await vi.waitFor(() => expect(f.projection().active.pending?.toolName).toBe('second'))
      await f.lanes.send(f.surface, { kind: 'approval', workspaceId, toolCallId: f.projection().active.pending!.toolCallId, action: 'allow-once' })
      await expect(second).resolves.toEqual({ taskId: 'second' })
    } finally { f.finish(); f.dispose() }
  })
  it('never offers a reusable grant for irreversible tools and excludes user approval time from the native deadline', async () => {
    const f = await fixture()
    try {
      const opened = await f.lanes.send(f.surface, { kind: 'workspace-open', binding: f.binding })
      const workspaceId = opened.ok ? opened.workspaceId : undefined
      await f.lanes.send(f.surface, { kind: 'prompt', text: 'Cancel this job', workspaceId, context: { approvalPolicy: { mode: 'safe-auto', spend: 'confirm' } } })
      await vi.waitFor(() => expect(f.run).toHaveBeenCalledOnce())
      const tool = { name: 'cancel_job', approvalSubject: { effect: 'reversible_write' as const, effectClass: 'irreversible' as const, destructiveHint: true, requiresPlanReview: false }, schema: { parse: (input: unknown) => input }, run: async () => ({ cancelled: true }) }
      const execution = mcp.execute!(tool as unknown as import('./agentTools').AgentTool, {})
      await vi.waitFor(() => expect(f.projection().active.pending?.toolName).toBe('cancel_job'))
      expect(f.projection().active.pending?.grantable).toBe(false)
      vi.useFakeTimers()
      await vi.advanceTimersByTimeAsync(31 * 60 * 1000)
      expect(f.run.mock.calls[0][0].signal.aborted).toBe(false)
      vi.useRealTimers()
      const toolCallId = f.projection().active.pending!.toolCallId
      expect((await f.lanes.send(f.surface, { kind: 'approval', workspaceId, toolCallId, action: 'allow-session' })).ok).toBe(false)
      await f.lanes.send(f.surface, { kind: 'approval', workspaceId, toolCallId, action: 'allow-once' })
      await expect(execution).resolves.toEqual({ cancelled: true })
    } finally { vi.useRealTimers(); f.finish(); f.dispose() }
  })

})

describe('native engine model identity', () => {
  it('clears the selected model when switching engines and keeps same-engine selection', async () => {
    const f=await fixture()
    try {
      expect(f.lanes.settings(f.surface,{model:'opencode-go/current'}).model).toBe('opencode-go/current')
      expect(f.lanes.settings(f.surface,{engine:'opencode'}).model).toBe('opencode-go/current')
      expect(f.lanes.settings(f.surface,{engine:'codex'}).model).not.toBe('opencode-go/current')
      f.lanes.settings(f.surface,{model:'configured-codex'})
      expect(f.lanes.settings(f.surface,{engine:'opencode'}).model).toBe('opencode-go/installed-model')
    }finally{f.dispose()}
  })
})

describe('explicit new conversation keeps legacy history intact', () => {
  it('publishes a fresh session and resumes its own native session only after the first real turn', async () => {
    const f=await fixture()
    try {
      const opened=await f.lanes.send(f.surface,{kind:'workspace-open',binding:f.binding})
      const workspaceId=opened.ok?opened.workspaceId:undefined
      await f.lanes.send(f.surface,{kind:'prompt',text:'Original history',workspaceId})
      await vi.waitFor(()=>expect(f.run).toHaveBeenCalledOnce())
      f.run.mock.calls[0][0].onEvent({kind:'session',id:'original-native-session'})
      f.finish();await vi.waitFor(()=>expect(f.projection().active.running).toBe(false))
      const original=f.projection().lanes.find(lane=>lane.laneName==='main')!.sessionId
      expect(await f.lanes.send(f.surface,{kind:'lane-create',laneName:'fresh-qa',workspaceId})).toEqual({ok:true})
      expect(f.projection().active.lane).toBe('fresh-qa');expect(f.projection().active.parts).toEqual([])
      expect(f.projection().lanes.find(lane=>lane.laneName==='fresh-qa')!.sessionId).not.toBe(original)
      await f.lanes.send(f.surface,{kind:'prompt',text:'Fresh tools',workspaceId})
      await vi.waitFor(()=>expect(f.run).toHaveBeenCalledTimes(2))
      expect(f.run.mock.calls[1][0].sessionId).toBeUndefined()
      expect(f.run.mock.calls[1][0].toolNames).toEqual([])
      f.finish();await vi.waitFor(()=>expect(f.projection().active.running).toBe(false))
      await f.lanes.send(f.surface,{kind:'lane-select',laneName:'main',workspaceId})
      expect(f.projection().active.parts[0]).toMatchObject({kind:'user',text:'Original history'})
    }finally{f.finish();f.dispose()}
  })
})
