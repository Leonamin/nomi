import { z } from 'zod'
import { documentWriteResultSchema } from '../electron/shared/agentCapabilities/documentWrite'
import { projectCanvasRead } from '../electron/shared/agentCapabilities/canvasRead'
import { formatCanvasForAgent } from '../electron/shared/agentCapabilities/canvasReadCompact'
import { randomUUID } from 'node:crypto'
import { modelFacingToolSpecs } from '../electron/shared/agentCapabilities/modelFacingToolRegistry'
import { capabilityContractById, capabilityPlanReviewOf } from '../electron/shared/agentCapabilities/registry'
import { mcpAnnotationsFor } from '../electron/shared/agentCapabilities/modelFacingTools'
import { approvalFacetsOf } from '../electron/shared/agentCapabilities/modelFacingTools'
import { createDocumentLaneTools, type DocumentLanePort } from '../electron/agentLane/laneDocumentTools'
import { verbToTransportCall } from '../electron/agentLane/laneVerbTransport'
import { registerSpendWaiter, type SpendDecision } from '../electron/capabilityCore/spendDecisionWaiters'
import { GENERATE_USER_DECISION_KEY } from '../electron/shared/agentLane/generateUserDecision'
import { captureGenerationContext } from '../electron/shared/agentCapabilities/generationInvocationContext'
import type { LaneComposerContext } from '../electron/shared/agentLane/laneDesktopContracts'
import type { ProjectBinding } from '../electron/shared/projectBinding'
import type { createWebProductionRuntime } from './productionRuntime'

export type WebSemanticAgentTool = import('./agentTools').AgentTool
export type WebSemanticAgentToolDependencies = {
  binding: ProjectBinding; signal: AbortSignal; documentPort: DocumentLanePort;
  generation: ReturnType<ReturnType<typeof createWebProductionRuntime>['forSurface']>;
  context?: LaneComposerContext;
  onDocumentExecuted?: () => void;
  onApprovalWaiting?: (isWaiting: boolean) => void;
  /** Runtime validates every exposed model through the original catalog availability owner. */
  readCanvas: () => unknown | Promise<unknown>;
  listModels: () => unknown | Promise<unknown>;
}

/** Native MCP receives the original model vocabulary/schema, not a second manually invented set. */
export function createWebSemanticAgentTools(deps: WebSemanticAgentToolDependencies): WebSemanticAgentTool[] {
  const documents = new Map(createDocumentLaneTools(deps.documentPort).filter(tool => tool.name === 'read_script').map(tool => [tool.name, tool]))
  let documentRead = false
  const names = new Set(['read_script', 'write_script', 'list_models', 'look_at_canvas', 'draft_shots', 'generate', 'check_job', 'cancel_job'])
  return modelFacingToolSpecs('internal').filter(spec => names.has(spec.name)).map(spec => {
    const contract = capabilityContractById(spec.contractId)
    if (!contract) throw new Error(`Unregistered semantic capability: ${spec.contractId}`)
    const facets = approvalFacetsOf(spec.effect)
    const schema = spec.name === 'write_script'
      ? (spec.schema as z.ZodObject<z.ZodRawShape>).extend({ where: z.enum(['end', 'whole-document']).describe('end appends; whole-document replaces the entire admitted document after read_script. Browser cursor/selection are unavailable.') })
      : spec.schema
    return {
    name: spec.name, description: spec.name === 'write_script'
      ? 'Write finished prose into the creation document. Use where=end to append, or where=whole-document to replace the entire document. Before replacing, call read_script in this turn and preserve any user content that should remain. Never use browser cursor or selection. Only report completion after this tool returns ok=true and a verified revision/contentHash. Never write tool invocation syntax as chat text.'
      : spec.description + (spec.name === 'read_script' ? '\nWeb host: only scope=full is available; browser selection is unavailable to server tools.' : ''), schema,
    approvalSubject: { ...facets, ...capabilityPlanReviewOf(contract), destructiveHint: mcpAnnotationsFor(contract)?.destructiveHint === true },
    hasDomainConfirmation: spec.name === 'generate',
    run: async raw => {
      if (deps.signal.aborted) throw new Error('Agent turn was stopped')
      const args = schema.parse(spec.prepareArguments ? spec.prepareArguments(raw) : raw)
      if (spec.name === 'write_script') {
        const operation = (args as { where: string }).where === 'whole-document' ? 'replace' : 'append'
        if (operation === 'replace' && !documentRead) throw new Error('Call read_script before replacing the whole document')
        const receipt = documentWriteResultSchema.parse(await deps.documentPort.write({ operation, content: (args as { content: string }).content }, { toolCallId: randomUUID(), signal: deps.signal }))
        deps.onDocumentExecuted?.()
        return { ok: true, text: `Applied ${operation} to the document. Verified revision ${receipt.revision}.`, details: receipt }
      }
      const toolCallId = randomUUID()
      const document = documents.get(spec.name)
      if (document) { const result = await document.execute(args, { toolCallId, signal: deps.signal }); if (result.ok) documentRead = true; return result }
      if (spec.name === 'list_models') return deps.listModels()
      if (spec.name === 'look_at_canvas') {
        const canvas = projectCanvasRead(await deps.readCanvas())
        return { ok: true, text: formatCanvasForAgent(canvas), details: { nodeCount: canvas.nodes.length } }
      }
      const translated = verbToTransportCall({ toolCallId, toolName: spec.name, args })
      if (!translated || translated.lane !== 'generation') throw new Error('This web tool only accepts generation-domain task references')
      if (spec.name === 'check_job') return { task: await deps.generation.readTask((args as { jobId: string }).jobId) }
      if (spec.name !== 'generate') return deps.generation.transport.tryExecute(translated.call, deps.signal, captureGenerationContext(deps.context))
      const operationId = (args as { operationId: string }).operationId
      let deliver: (decision: SpendDecision) => void = () => undefined
      const decided = new Promise<SpendDecision>(resolve => { deliver = resolve })
      // Register before present: the saved card is visible as soon as the original owner commits.
      const release = registerSpendWaiter(deps.binding.projectId, operationId, deliver)
      const onAbort = () => { deliver({ kind: 'declined' }); if (deps.signal.reason === 'user-stopped') void deps.generation.transport.withdrawPresentation(operationId, 'stopped').catch(() => undefined) }
      deps.signal.addEventListener('abort', onAbort, { once: true })
      try {
        const presented = await deps.generation.transport.tryExecute(translated.call, deps.signal, captureGenerationContext(deps.context))
        if (!presented?.ok || !presented.result || typeof presented.result !== 'object' || (presented.result as { nextAction?: unknown }).nextAction !== 'await_user') return presented
        deps.onApprovalWaiting?.(true)
        try { await decided } finally { deps.onApprovalWaiting?.(false) }
        if (deps.signal.aborted) return { ok: false, code: 'generation_cancelled', message: 'generation_cancelled' }
        const shots = await deps.generation.transport.readPresentationOutcome(operationId)
        if (!shots) return { ok: false, code: 'generation_execution_failed', message: 'generation_execution_failed' }
        return { ok: true, result: { ...presented.result, [GENERATE_USER_DECISION_KEY]: { outcome: 'card_closed', shots } } }
      } finally { release(); deps.signal.removeEventListener('abort', onAbort) }
    },
  }
  })
}
