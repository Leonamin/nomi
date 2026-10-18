import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { writeJsonFileAtomic } from '../electron/jsonFile'
import type { LanePart, LanePendingApproval, LaneWorkspaceProjection, LaneUsage } from '../electron/shared/agentLane/laneContracts'
import type { LaneDesktopCommand, LaneDesktopResult, LaneComposerContext, LaneSingleShotRequest } from '../electron/shared/agentLane/laneDesktopContracts'
import { parseLaneCommand } from '../electron/agentLane/laneCommandCodec'
import { sameProjectAgentBinding, projectAgentPartitionKey, type ProjectBinding } from '../electron/shared/projectBinding'
import { DEFAULT_PROJECT_AGENT_APPROVAL_POLICY, capabilityMayReuseSafeApproval, spendDecidedByPolicy } from '../electron/shared/agentCapabilities/capabilityApprovalPolicy'
import type { WebAgentEngine, WebAgentSelection, WebAgentSettings } from '../electron/shared/webAgentContracts'
import { listNativeAgentModels, runNativeAgent, type NativeAgentTurn, type NativeAgentEvent } from './agentProcess'
import { openAgentMcp } from './agentMcp'
import type { AgentTool } from './agentTools'
import type { createWebSurface } from './surface'
import { hostEvents } from './runtimeHost'
import { projectDirById } from '../electron/projects/repository'
import { ensureWorkspaceProjectIdentity } from '../electron/workspace/workspaceProjectIdentity'
import { prepareWebCreationContext, webCreationSystemPrompt } from './creationContext'

type Surface = ReturnType<typeof createWebSurface>
type Conversation = { id: string; createdAt: number; updatedAt: number; parts: LanePart[]; nativeSessions: Partial<Record<WebAgentEngine, string>>; usage: LaneUsage; isRunning: boolean; model?: { provider: string; modelId: string } }
type ProjectState = { binding: ProjectBinding; active: string; engine: WebAgentEngine; model?: string; lanes: Record<string, Conversation> }
type RunningTurn = { controller: AbortController; pending?: LanePendingApproval; answer?: (hasApproved: boolean) => void; safeGrants: Set<string> }
type View = { surfaceId: number; state: ProjectState }
type ToolFactory = (surface: Surface, binding: ProjectBinding, context: LaneComposerContext, signal: AbortSignal, onApprovalWaiting?: (isWaiting: boolean) => void) => Promise<{ tools: AgentTool[]; context?: LaneComposerContext; dispose(): void }>
const AGENT_ENGINES = ['opencode', 'codex', 'claude'] as const
const unknown = { state: 'unknown', reason: 'no-settled-turn' } as const
function emptyUsage(): LaneUsage { return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: unknown, contextTokens: unknown, reasoningTokens: unknown } }
function conversation(): Conversation { return { id: randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), parts: [], nativeSessions: {}, usage: emptyUsage(), isRunning: false } }
const failure = (diagnostic: string): LaneDesktopResult => ({ ok: false, code: 'agent_lane_execute_failed', diagnostic })

/** Durable project conversations own execution. Browser workspaces are only scoped subscriptions. */
export class WebAgentLanes {
  private projects = new Map<string, ProjectState>()
  private views = new Map<string, View>()
  private turns = new Map<string, RunningTurn>()
  private isolated = new Map<string, { surfaceId: number; controller: AbortController }>()
  constructor(private root: string, private run: (turn: NativeAgentTurn) => Promise<void> = runNativeAgent, private tools: ToolFactory = async () => { throw new Error('Production tool factory is not installed') }) { fs.mkdirSync(root, { recursive: true, mode: 0o700 }) }
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
  private scope(surface: Surface) {
    const selected = surface.registry.getCommittedProjectSelection()
    if (!selected) throw new Error('Open a project first')
    const binding = { projectId: selected.projectId, immutableProjectUuid: selected.immutableProjectUuid, projectGeneration: selected.projectGeneration }
    const state = this.load(binding)
    return { state, lane: state.lanes[state.active] }
  }
  /** 선택이 없을 때 엔진이 스스로 기억하는 기본 모델(env → 엔진 저장소). Nomi가 만들어내지 않는다. */
  private defaultModel(state: ProjectState): string {
    if (state.engine === 'claude') return process.env.NOMI_WEB_CLAUDE_MODEL || ''
    if (state.engine !== 'opencode') return process.env.NOMI_WEB_CODEX_MODEL || ''
    const fromEnv = process.env.NOMI_WEB_OPENCODE_MODEL || ''
    if (fromEnv) return fromEnv
    try {
      const file = path.join(os.homedir(), '.local/state/opencode/model.json')
      const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
      const choice = [...(saved.favorite || []), ...(saved.recent || [])].find(row => typeof row.providerID === 'string' && row.providerID.trim() && typeof row.modelID === 'string' && row.modelID.trim())
      return choice ? `${choice.providerID}/${choice.modelID}` : ''
    } catch { return '' }
  }
  settings(surface: Surface, selection: WebAgentSelection = {}): WebAgentSettings {
    const { state, lane } = this.scope(surface)
    const shouldChange = selection.engine !== undefined || selection.model !== undefined
    if (shouldChange && lane.isRunning) throw new Error('Stop or finish the current request before changing agents')
    if (selection.engine) {
      z.enum(AGENT_ENGINES).parse(selection.engine)
      if (state.engine !== selection.engine) state.model = undefined
      state.engine = selection.engine
    }
    // 엔진이 실제로 아는 모델만 받는다. 빈 값은 '엔진 기본값으로 되돌림'.
    if (selection.model !== undefined) state.model = selection.model.trim() || undefined
    if (shouldChange) this.publish(state)
    return { engine: state.engine, model: state.model ?? this.defaultModel(state), models: [], engines: AGENT_ENGINES }
  }
  /** 엔진이 **실제로 인증한** 모델 목록. 못 읽으면 이유를 그대로 돌려준다(성공으로 위장하지 않음). */
  async listModels(surface: Surface, engine?: WebAgentEngine): Promise<{ models: readonly string[]; error?: string }> {
    const { state } = this.scope(surface)
    const target = engine ?? state.engine
    z.enum(AGENT_ENGINES).parse(target)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    timer.unref?.()
    try {
      const models = await listNativeAgentModels(target, controller.signal)
      if (models.length) return { models }
      // Codex에 목록 커맨드가 없다는 사실과, OpenCode가 빈손인 것은 다른 이야기다.
      return { models: [], error: target !== 'opencode' ? 'engine-lists-no-models' : 'engine-models-empty' }
    } finally { clearTimeout(timer) }
  }
  async send(surface: Surface, command: LaneDesktopCommand): Promise<LaneDesktopResult> {
    try {
      if (command.kind === 'single-shot') return await this.singleShot(surface, command)
      if (command.kind === 'single-shot-abort') {
        const request = this.isolated.get(command.requestId)
        if (request && request.surfaceId !== surface.id) throw new Error('Creation request belongs to another browser')
        request?.controller.abort()
        return { ok: true }
      }
      if (command.kind === 'workspace-close') {
        const view = command.workspaceId && this.views.get(command.workspaceId)
        if (view && view.surfaceId !== surface.id) throw new Error('Agent workspace belongs to another browser')
        // Home releases the project authority before retiring this subscription.
        // Closing a subscription grants no project access and never stops execution.
        if (command.workspaceId) this.views.delete(command.workspaceId)
        return { ok: true }
      }
      if (command.kind === 'workspace-open') {
        const selected = surface.registry.getCommittedProjectSelection()
        if (!selected || !sameProjectAgentBinding(command.binding, selected)) throw new Error('Open the current project before connecting the agent')
        const state = this.load(command.binding); const workspaceId = randomUUID()
        for (const [id, view] of this.views) if (view.surfaceId === surface.id) this.views.delete(id)
        this.views.set(workspaceId, { surfaceId: surface.id, state }); this.publish(state)
        return { ok: true, workspaceId }
      }
      const state = this.current(surface, command); const lane = state.lanes[state.active]
      if (command.kind === 'receipt-read') return { ok: true, receipt: null }
      if (command.kind === 'workspace-policy') return { ok: true }
      if (command.kind === 'abort') { const turn = this.turns.get(lane.id); turn?.controller.abort('user-stopped'); turn?.answer?.(false); return { ok: true } }
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
        this.part(lane, { kind: 'user', text: command.context?.displayText || parsed.text })
        lane.isRunning = true; lane.model = { provider: settings.engine, modelId: settings.model || (settings.engine === 'claude' ? 'Claude' : 'Codex') }
        this.publish(state)
        void this.execute(surface, state, lane, parsed.text, settings, command.context).catch(error => console.error('Web agent execution failed:', error))
        return { ok: true }
      } else throw new Error('This command is not supported by native web agents')
      this.publish(state); return { ok: true }
    } catch (error) { return failure(error instanceof Error ? error.message : String(error)) }
  }
  private async singleShot(surface: Surface, request: LaneSingleShotRequest): Promise<LaneDesktopResult> {
    z.string().min(1).max(256).parse(request.requestId)
    z.string().min(1).max(256).parse(request.featureKey)
    const parsed = parseLaneCommand({ kind: 'prompt', text: request.prompt })
    if (parsed.kind !== 'prompt') throw new Error('Invalid creation prompt')
    const selected = surface.registry.getCommittedProjectSelection()
    if (!selected || (request.projectId !== undefined && selected.projectId !== request.projectId)) throw new Error('Creation request belongs to another project')
    if (this.isolated.has(request.requestId)) throw new Error('Creation request is already running')
    const controller = new AbortController()
    this.isolated.set(request.requestId, { surfaceId: surface.id, controller })
    const lane = conversation()
    const deadline = setTimeout(() => controller.abort(), 30 * 60 * 1000)
    deadline.unref()
    const mcp = await openAgentMcp([], controller.signal, async () => { throw new Error('No tools in isolated creation') })
    try {
      const context = await prepareWebCreationContext(request.context)
      const directory = projectDirById(selected.projectId)
      if (!directory || !sameProjectAgentBinding(selected, await ensureWorkspaceProjectIdentity(directory))) throw new Error('Creation project identity changed')
      const settings = this.settings(surface)
      if (settings.engine === 'opencode' && !settings.model) throw new Error('Select an authenticated OpenCode model')
      await this.run({ engine: settings.engine, model: settings.model, mcpUrl: mcp.url, mcpToken: mcp.token, toolNames: [], prompt: `${webCreationSystemPrompt(context)}\n\nUser request:\n${parsed.text}`, directory: path.join(this.root, 'sandbox', lane.id), signal: controller.signal, onEvent: event => {
        if (event.kind === 'text' || event.kind === 'thinking') this.part(lane, { kind: event.kind === 'text' ? 'assistant-text' : 'thinking', text: event.text, streaming: false })
        else if (event.kind === 'error') this.part(lane, { kind: 'error', text: event.text })
        else if (event.kind === 'usage') lane.usage = { ...lane.usage, inputTokens: lane.usage.inputTokens + event.input, outputTokens: lane.usage.outputTokens + event.output, cacheReadTokens: lane.usage.cacheReadTokens + event.cacheRead, totalTokens: lane.usage.totalTokens + event.input + event.output + event.cacheRead }
      } })
      controller.signal.throwIfAborted()
      // Results retain their feature request identity and never enter the user's conversation.
      return { ok: true, singleShot: { lane: request.featureKey, parts: lane.parts, running: false, usage: lane.usage, queues: [], thinking: { supportedLevels: [], level: 'off', canTurnOff: false } } }
    } finally { clearTimeout(deadline); controller.abort(); await mcp.close(); this.isolated.delete(request.requestId) }
  }
  private async execute(surface: Surface, state: ProjectState, lane: Conversation, prompt: string, settings: WebAgentSettings, context?: LaneComposerContext) {
    const controller = new AbortController()
    const turn: RunningTurn = { controller, safeGrants: new Set() }
    this.turns.set(lane.id, turn)
    try { context = await prepareWebCreationContext(context || { approvalPolicy: DEFAULT_PROJECT_AGENT_APPROVAL_POLICY }) }
    catch (error) { this.turns.delete(lane.id); lane.isRunning = false; this.part(lane, { kind: 'error', text: error instanceof Error ? error.message : String(error) }); this.publish(state); return }
    let deadline: ReturnType<typeof setTimeout> | undefined
    let remainingMs = 30 * 60 * 1000
    let resumedAt = Date.now()
    const setApprovalWaiting = (isWaiting: boolean) => {
      if (deadline) { clearTimeout(deadline); deadline = undefined; remainingMs -= Date.now() - resumedAt }
      if (!isWaiting && !controller.signal.aborted) { resumedAt = Date.now(); deadline = setTimeout(() => { controller.abort(); turn.answer?.(false) }, Math.max(0, remainingMs)); deadline.unref() }
    }
    const executeTool = async (tool: AgentTool, input: unknown) => {
      controller.signal.throwIfAborted()
      const callId = randomUUID()
      const index = this.part(lane, { kind: 'tool-call', toolCallId: callId, toolName: tool.name, args: input, running: true })
      this.publish(state)
      let isError = false; let text: string
      try {
        const policy = context?.approvalPolicy || DEFAULT_PROJECT_AGENT_APPROVAL_POLICY
        const subject = tool.approvalSubject
        const effectClass = subject.effectClass
        const canProceed = subject.effect === 'read' || tool.hasDomainConfirmation || (subject.effect === 'paid' ? spendDecidedByPolicy(policy) : capabilityMayReuseSafeApproval(policy, subject, turn.safeGrants.has(tool.name)))
        if (!canProceed) {
          turn.pending = { toolCallId: callId, toolName: tool.name, args: input, effectClass, grantable: effectClass === 'reversible_local' && !subject.destructiveHint && policy.mode !== 'step', pendingCount: 1 }
          this.publish(state)
          setApprovalWaiting(true)
          let hasApproved: boolean
          try { hasApproved = await new Promise<boolean>(resolve => { turn.answer = resolve }) } finally { setApprovalWaiting(false) }
          turn.pending = undefined; turn.answer = undefined
          if (!hasApproved) throw new Error('User declined this action')
        }
        controller.signal.throwIfAborted()
        const directory = projectDirById(state.binding.projectId)
        if (!directory || !sameProjectAgentBinding(state.binding, await ensureWorkspaceProjectIdentity(directory))) throw new Error('Agent project identity changed')
        // tool.run owns argument preparation and validation; parsing here first rejected stringified arrays.
        text = JSON.stringify(await tool.run(input))
      } catch (error) { isError = true; text = error instanceof Error ? error.message : String(error) }
      lane.parts[index] = { ...lane.parts[index], running: false } as LanePart
      this.part(lane, { kind: 'tool-result', toolCallId: callId, toolName: tool.name, text, isError })
      this.publish(state)
      if (isError) throw new Error(text)
      return JSON.parse(text)
    }
    // Native engines may invoke MCP tools in parallel; Nomi's single approval slot has one owner.
    let toolQueue: Promise<unknown> = Promise.resolve()
    let domain: Awaited<ReturnType<ToolFactory>>
    try { domain = await this.tools(surface, state.binding, context, controller.signal, setApprovalWaiting) }
    catch (error) { this.turns.delete(lane.id); lane.isRunning = false; this.part(lane, { kind: 'error', text: error instanceof Error ? error.message : String(error) }); this.publish(state); return }
    context = domain.context ?? context
    const mcp = await openAgentMcp(domain.tools, controller.signal, (tool, input) => {
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
    setApprovalWaiting(false)
    try {
      const history = lane.parts.filter(part => part.kind === 'user' || part.kind === 'assistant-text').slice(-12)
      await this.run({ engine: settings.engine, model: settings.model, prompt: `${webCreationSystemPrompt(context)}\nUse only the Nomi MCP tools. Their native identifiers are: ${domain.tools.map(tool => settings.engine === 'opencode' ? `nomi_${tool.name}` : settings.engine === 'claude' ? `mcp__nomi__${tool.name}` : tool.name).join(', ')}. Use read_script, list_models and draft_shots for the original document storyboard. Use generate only when the user requested GPU generation; its original Nomi confirmation settles the action. For a recurring character or scene: draft it once as a role=anchor shot (storyboard.kind and carrier set), generate it, find its image with look_at_media, then give every later shot that image in references with a list_models model whose accepts.image is true (role first_frame for a single-image edit or image-to-video model; anchorIds alone sends no image). The user, not you, freezes anchors. Never automatically retry generation, select candidates or alter the timeline.\nRecent conversation: ${JSON.stringify(history).slice(-40000)}\nUser request: ${prompt}`, directory: path.join(this.root, 'sandbox', lane.id), sessionId: lane.nativeSessions[settings.engine], mcpUrl: mcp.url, mcpToken: mcp.token, toolNames: domain.tools.map(tool => tool.name), signal: controller.signal, onEvent })
    } catch (error) { if (!controller.signal.aborted) this.part(lane, { kind: 'error', text: error instanceof Error ? error.message : String(error) }) }
    finally { clearTimeout(deadline); turn.answer?.(false); controller.abort('native-turn-ended'); await toolQueue.catch(() => undefined); await mcp.close(); domain.dispose(); this.turns.delete(lane.id); lane.isRunning = false; this.publish(state) }
  }
}
