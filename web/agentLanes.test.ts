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
import type { WebGenerationJobs } from './generationJobs'
async function fixture() {
  process.env.NOMI_WEB_OPENCODE_MODEL = 'opencode-go/installed-model'
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-agent-lanes-'))
  let finish: () => void = () => undefined
  const run = vi.fn((_turn: NativeAgentTurn) => new Promise<void>(resolve => { finish = resolve }))
  const lanes = new WebAgentLanes(root, {} as WebGenerationJobs, run)
  const project = createProject({ name: 'Agent lane identity' })
  const surface = createSurface('http://localhost')
  const suspension = surface.suspend({ surfaceInstanceId: crypto.randomUUID() }).value.suspension
  await surface.commit({ projectId: project.id, suspension })
  const selected = surface.registry.getCommittedProjectSelection()!
  const binding = { projectId: selected.projectId, immutableProjectUuid: selected.immutableProjectUuid, projectGeneration: selected.projectGeneration }
  let projection: LaneWorkspaceProjection | undefined
  const listener = (event: { payload: LaneWorkspaceProjection; targetSurfaceId?: number }) => { if (event.targetSurfaceId === surface.id) projection = JSON.parse(JSON.stringify(event.payload)) }
  hostEvents.on('message', listener)
  return { lanes, surface, binding, root, run, finish: () => finish(), projection: () => projection!, dispose: () => hostEvents.off('message', listener) }
}
describe('native web lanes keep execution separate from browser subscriptions', () => {
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
      const restored = new WebAgentLanes(f.root, {} as WebGenerationJobs, f.run)
      await restored.send(f.surface, { kind: 'workspace-open', binding })
      expect(f.projection().active.parts[0]).toMatchObject({ kind: 'user', text: 'Read my project' })
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
      const tool = (name: string) => ({ name, effect: 'paid', schema: { parse: (input: unknown) => input }, run: async () => ({ taskId: name }) })
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
})
