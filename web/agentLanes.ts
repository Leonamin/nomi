import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { writeJsonFileAtomic } from '../electron/jsonFile'
import type { LanePart, LanePendingApproval, LaneWorkspaceProjection, LaneUsage } from '../electron/shared/agentLane/laneContracts'
import type { LaneDesktopCommand, LaneDesktopResult, LaneComposerContext } from '../electron/shared/agentLane/laneDesktopContracts'
import { parseLaneCommand } from '../electron/agentLane/laneCommandCodec'
import { sameProjectAgentBinding, projectAgentPartitionKey, type ProjectBinding } from '../electron/shared/projectBinding'
import { DEFAULT_PROJECT_AGENT_APPROVAL_POLICY, capabilityMayReuseSafeApproval, spendDecidedByPolicy } from '../electron/shared/agentCapabilities/capabilityApprovalPolicy'
import type { WebAgentEngine, WebAgentSettings } from '../electron/shared/webAgentContracts'
import { runNativeAgent, type NativeAgentTurn, type NativeAgentEvent } from './agentProcess'
import { openAgentMcp } from './agentMcp'
import { createAgentTools, type AgentTool } from './agentTools'
import type { WebGenerationJobs } from './generationJobs'
import type { createWebSurface } from './surface'
import { hostEvents } from './runtimeHost'
import { projectDirById } from '../electron/projects/repository'
import { ensureWorkspaceProjectIdentity } from '../electron/workspace/workspaceProjectIdentity'

type Surface = ReturnType<typeof createWebSurface>
type Conversation = { id: string; createdAt: number; updatedAt: number; parts: LanePart[]; nativeSessions: Partial<Record<WebAgentEngine, string>>; usage: LaneUsage; isRunning: boolean; model?: { provider: string; modelId: string } }
type ProjectState = { binding: ProjectBinding; active: string; engine: WebAgentEngine; lanes: Record<string, Conversation> }
type RunningTurn = { controller: AbortController; pending?: LanePendingApproval; answer?: (hasApproved: boolean) => void; safeGrants: Set<string> }
type View = { surfaceId: number; state: ProjectState }
const unknown = { state: 'unknown', reason: 'no-settled-turn' } as const
function emptyUsage(): LaneUsage { return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: unknown, contextTokens: unknown, reasoningTokens: unknown } }
function conversation(): Conversation { return { id: randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), parts: [], nativeSessions: {}, usage: emptyUsage(), isRunning: false } }
const failure = (diagnostic: string): LaneDesktopResult => ({ ok: false, code: 'agent_lane_execute_failed', diagnostic })

/** Durable project conversations own execution. Browser workspaces are only scoped subscriptions. */
export class WebAgentLanes {
  private projects = new Map<string, ProjectState>()
  private views = new Map<string, View>()
  private turns = new Map<string, RunningTurn>()
  constructor(private root: string, private jobs: WebGenerationJobs, private run: (turn: NativeAgentTurn) => Promise<void> = runNativeAgent) { fs.mkdirSync(root, { recursive: true, mode: 0o700 }) }
  detachSurface(surfaceId: number) { for (const [id, view] of this.views) if (view.surfaceId === surfaceId) this.views.delete(id) }
  private file(binding: ProjectBinding) { return path.join(this.root, `${projectAgentPartitionKey(binding)}.json`) }
  private save(state: ProjectState) { writeJsonFileAtomic(this.file(state.binding), state) }
  private load(binding: ProjectBinding): ProjectState {
    const key = projectAgentPartitionKey(binding)
    let state = this.projects.get(key)
    if (!state) {
      state = fs.existsSync(this.file(binding)) ? JSON.parse(fs.readFileSync(this.file(binding), 'utf8')) as ProjectState : { binding, active: 'main', engine: 'opencode', lanes: { main: conversation() } }
      if (!sameProjectAgentBinding(state.binding, binding)) throw new Error('Agent project identity changed')
      for (const lane of Object.values(state.lanes)) if (lane.isRunning) { lane.isRunning = false; this.part(lane, { kind: 'error', text: 'Agent execution was interrupted by a server restart. Inspect existing shots before sending again.' }) }
      this.projects.set(key, state); this.save(state)
    }
    return state
  }
  private part(lane: Conversation, input: Record<string, unknown>): number {
    const sequence = lane.parts.length
    lane.parts.push({ entryId: randomUUID(), sequence, entrySeq: sequence, contentIndex: 0, ...input } as unknown as LanePart)
    lane.updatedAt = Date.now()
    return sequence
  }
  private projection(workspaceId: string, state: ProjectState): LaneWorkspaceProjection {
    const lane = state.lanes[state.active]
    return {
      workspaceId,
      lanes: Object.entries(state.lanes).map(([laneName, row]) => ({ laneName, sessionId: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt })),
      active: { lane: state.active, parts: lane.parts, running: lane.isRunning, usage: lane.usage, model: lane.model, queues: [], pending: this.turns.get(lane.id)?.pending, thinking: { supportedLevels: [], level: 'off', canTurnOff: false } },
    }
  }
  private publish(state: ProjectState) {
    this.save(state)
    for (const [workspaceId, view] of this.views) if (view.state === state) hostEvents.emit('message', { targetSurfaceId: view.surfaceId, channel: 'nomi:agent-lane:projection', payload: this.projection(workspaceId, state) })
  }
  private current(surface: Surface, command: LaneDesktopCommand) {
    const view = command.workspaceId && this.views.get(command.workspaceId)
    const selected = surface.registry.getCommittedProjectSelection()
    if (!view || view.surfaceId !== surface.id || !selected || !sameProjectAgentBinding(view.state.binding, selected)) throw new Error('Agent workspace no longer belongs to this browser project')
    const lane = view.state.lanes[view.state.active]
    if ((command.expectedLane && command.expectedLane !== view.state.active) || (command.expectedSessionId && command.expectedSessionId !== lane.id)) throw new Error('Agent conversation changed')
    return view.state
  }
  settings(surface: Surface, engine?: WebAgentEngine): WebAgentSettings {
    const selected = surface.registry.getCommittedProjectSelection()
    if (!selected) throw new Error('Open a project first')
    const binding = { projectId: selected.projectId, immutableProjectUuid: selected.immutableProjectUuid, projectGeneration: selected.projectGeneration }
    const state = this.load(binding)
    if (engine) {
      z.enum(['opencode', 'codex']).parse(engine)
      if (state.lanes[state.active].isRunning) throw new Error('Stop or finish the current request before changing agents')
      state.engine = engine; this.publish(state)
    }
    let model: string
    if (state.engine === 'opencode') {
      model = process.env.NOMI_WEB_OPENCODE_MODEL || ''
      if (!model) {
        const file = path.join(os.homedir(), '.local/state/opencode/model.json')
        const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
        const choice = [...(saved.favorite || []), ...(saved.recent || [])].find(row => row.providerID === 'opencode-go')
        if (choice) model = `${choice.providerID}/${choice.modelID}`
      }
    } else model = process.env.NOMI_WEB_CODEX_MODEL || ''
    return { engine: state.engine, model, engines: ['opencode', 'codex'] }
  }
  async send(surface: Surface, command: LaneDesktopCommand): Promise<LaneDesktopResult> {
    try {
      if (command.kind === 'workspace-open') {
        const selected = surface.registry.getCommittedProjectSelection()
        if (!selected || !sameProjectAgentBinding(command.binding, selected)) throw new Error('Open the current project before connecting the agent')
        const state = this.load(command.binding); const workspaceId = randomUUID()
        for (const [id, view] of this.views) if (view.surfaceId === surface.id) this.views.delete(id)
        this.views.set(workspaceId, { surfaceId: surface.id, state }); this.publish(state)
        return { ok: true, workspaceId }
      }
      const state = this.current(surface, command); const lane = state.lanes[state.active]
      if (command.kind === 'workspace-close') { this.views.delete(command.workspaceId!); return { ok: true } }
      if (command.kind === 'receipt-read') return { ok: true, receipt: null }
      if (command.kind === 'workspace-policy') return { ok: true }
      if (command.kind === 'abort') { const turn = this.turns.get(lane.id); turn?.controller.abort(); turn?.answer?.(false); return { ok: true } }
      if (command.kind === 'approval') {
        const turn = this.turns.get(lane.id)
        if (!turn?.pending || command.toolCallId !== turn.pending.toolCallId) throw new Error('Approval is no longer pending')
        if (command.action === 'allow-session' && !turn.pending.grantable) throw new Error('This action requires individual confirmation')
        const hasApproved = command.action === 'allow-once' || command.action === 'allow-session'
        if (command.action === 'allow-session') turn.safeGrants.add(turn.pending.toolName)
        turn.answer?.(hasApproved); return { ok: true }
      }
      const parsed = parseLaneCommand(command)
      if (!parsed) throw new Error('Invalid agent command')
      if (lane.isRunning) return { ok: false, code: 'agent_lane_busy_running', diagnostic: 'Stop or finish this request first' }
      if (parsed.kind === 'lane-create') { if (state.lanes[parsed.laneName]) throw new Error('Conversation already exists'); state.lanes[parsed.laneName] = conversation(); state.active = parsed.laneName }
      else if (parsed.kind === 'lane-select') { if (!state.lanes[parsed.laneName]) throw new Error('Conversation not found'); state.active = parsed.laneName }
      else if (parsed.kind === 'lane-delete') { if (state.active === parsed.laneName) throw new Error('Cannot delete the active conversation'); delete state.lanes[parsed.laneName] }
      else if (parsed.kind === 'prompt') {
        const settings = this.settings(surface)
        if (settings.engine === 'opencode' && !settings.model) return { ok: false, code: 'agent_lane_model_unconfigured', diagnostic: 'Select an authenticated OpenCode model or configure NOMI_WEB_OPENCODE_MODEL' }
        if (command.context?.attachments?.length || command.context?.skillKey) throw new Error('Native web agents currently accept text and Nomi project tools; remove the attachment or skill before sending')
        this.part(lane, { kind: 'user', text: command.context?.displayText || parsed.text })
        lane.isRunning = true; lane.model = { provider: settings.engine, modelId: settings.model || 'Codex' }
        this.publish(state)
        void this.execute(state, lane, parsed.text, settings, command.context).catch(error => console.error('Web agent execution failed:', error))
        return { ok: true }
      } else throw new Error('This command is not supported by native web agents')
      this.publish(state); return { ok: true }
    } catch (error) { return failure(error instanceof Error ? error.message : String(error)) }
  }
  private async execute(state: ProjectState, lane: Conversation, prompt: string, settings: WebAgentSettings, context?: LaneComposerContext) {
    const controller = new AbortController()
    const turn: RunningTurn = { controller, safeGrants: new Set() }
    this.turns.set(lane.id, turn)
    const turnId = randomUUID()
    const executeTool = async (tool: AgentTool, input: unknown) => {
      controller.signal.throwIfAborted()
      const callId = randomUUID()
      const index = this.part(lane, { kind: 'tool-call', toolCallId: callId, toolName: tool.name, args: input, running: true })
      this.publish(state)
      let isError = false; let text: string
      try {
        const policy = context?.approvalPolicy || DEFAULT_PROJECT_AGENT_APPROVAL_POLICY
        const effectClass = tool.effect === 'paid' ? 'spend' : 'reversible_local'
        const subject = { effect: tool.effect, effectClass, requiresPlanReview: false, destructiveHint: false } as const
        const canProceed = tool.effect === 'read' || (tool.effect === 'paid' ? spendDecidedByPolicy(policy) : capabilityMayReuseSafeApproval(policy, subject, turn.safeGrants.has(tool.name)))
        if (!canProceed) {
          turn.pending = { toolCallId: callId, toolName: tool.name, args: input, effectClass, grantable: tool.effect === 'reversible_write' && policy.mode !== 'step', pendingCount: 1 }
          this.publish(state)
          const hasApproved = await new Promise<boolean>(resolve => { turn.answer = resolve })
          turn.pending = undefined; turn.answer = undefined
          if (!hasApproved) throw new Error('User declined this action')
        }
        controller.signal.throwIfAborted()
        const directory = projectDirById(state.binding.projectId)
        if (!directory || !sameProjectAgentBinding(state.binding, await ensureWorkspaceProjectIdentity(directory))) throw new Error('Agent project identity changed')
        text = JSON.stringify(await tool.run(tool.schema.parse(input)))
      } catch (error) { isError = true; text = error instanceof Error ? error.message : String(error) }
      lane.parts[index] = { ...lane.parts[index], running: false } as LanePart
      this.part(lane, { kind: 'tool-result', toolCallId: callId, toolName: tool.name, text, isError })
      this.publish(state)
      if (isError) throw new Error(text)
      return JSON.parse(text)
    }
    // Native engines may invoke MCP tools in parallel; Nomi's single approval slot has one owner.
    let toolQueue: Promise<unknown> = Promise.resolve()
    const mcp = await openAgentMcp(createAgentTools(state.binding, turnId, this.jobs), controller.signal, (tool, input) => {
      const execution = toolQueue.catch(() => undefined).then(() => executeTool(tool, input))
      toolQueue = execution
      return execution
    }).catch(error => { this.turns.delete(lane.id); lane.isRunning = false; this.part(lane, { kind: 'error', text: String(error) }); this.publish(state); throw error })
    const onEvent = (event: NativeAgentEvent) => {
      if (event.kind === 'session') lane.nativeSessions[settings.engine] = event.id
      else if (event.kind === 'text' || event.kind === 'thinking') this.part(lane, { kind: event.kind === 'text' ? 'assistant-text' : 'thinking', text: event.text, streaming: false })
      else if (event.kind === 'error') this.part(lane, { kind: 'error', text: event.text })
      else if (event.kind === 'usage') lane.usage = { ...lane.usage, inputTokens: lane.usage.inputTokens + event.input, outputTokens: lane.usage.outputTokens + event.output, cacheReadTokens: lane.usage.cacheReadTokens + event.cacheRead, totalTokens: lane.usage.totalTokens + event.input + event.output + event.cacheRead, contextTokens: { state: 'known', value: event.input + event.cacheRead }, cost: { state: 'unknown', reason: 'model-has-no-pricing' } }
      this.publish(state)
    }
    const deadline = setTimeout(() => { controller.abort(); turn.answer?.(false) }, 30 * 60 * 1000)
    deadline.unref()
    try {
      const history = lane.parts.filter(part => part.kind === 'user' || part.kind === 'assistant-text').slice(-12)
      await this.run({ engine: settings.engine, model: settings.model, prompt: `You are Nomi’s video creation assistant. Use only the Nomi MCP tools. Read the project and enabled models before creating or generating shots. Never automatically retry generation, select candidates or alter the timeline. Reply in the user’s language.\nRecent conversation: ${JSON.stringify(history).slice(-40000)}\nUser request: ${prompt}`, directory: path.join(this.root, 'sandbox', lane.id), sessionId: lane.nativeSessions[settings.engine], mcpUrl: mcp.url, mcpToken: mcp.token, signal: controller.signal, onEvent })
    } catch (error) { if (!controller.signal.aborted) this.part(lane, { kind: 'error', text: error instanceof Error ? error.message : String(error) }) }
    finally { clearTimeout(deadline); turn.answer?.(false); controller.abort(); await toolQueue.catch(() => undefined); await mcp.close(); this.turns.delete(lane.id); lane.isRunning = false; this.publish(state) }
  }
}
