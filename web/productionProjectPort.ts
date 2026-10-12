import { randomUUID } from 'node:crypto'
import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { readProject, saveProject, type ProjectRecord } from '../electron/projects/repository'
import type { ProjectBinding } from '../electron/shared/projectBinding'
import { SurfacePortWireError } from '../electron/shared/surfacePortBinding'
import { addNodes, normalizeSnapshot } from '../electron/capabilityCore/canvasGraph'
import { layoutStoryboardNodesWith } from '../electron/capabilityCore/canvasNodeLayout'
import { nodeKindFootprint } from '../electron/capabilityCore/nodeKindDomain'
import type { AgentModelEntry } from '../electron/shared/agentCapabilities/availableModels'
import type { DocumentLanePort } from '../electron/agentLane/laneDocumentTools'
import type { PreconditionSet } from '../electron/shared/capabilityTargeting'
import { applyWholeDocumentWrite, documentSessionState, workbenchDocumentPlainText, type DocumentSessionWriteInput } from '../src/workbench/project/documentSessionCore'
import { assertDocumentWritePreconditions } from '../src/workbench/creation/documentWriteTarget'
import { createWorkbenchDocumentSlice, type WorkbenchDocumentSlice } from '../src/workbench/workbenchDocumentSlice'
import { createAgentStoryboardDesign } from '../src/workbench/creation/storyboard/agentStoryboardDesignCore'
import { createMultiShotCanvasLanding, type LandingCanvasState } from '../src/workbench/capability/multiShotCanvasLandingCore'
import { buildModelEntryIndex, buildPlannedNodeMeta } from '../src/workbench/generationCanvas/agent/plannedNodeMeta'
import { nodeRunOutcomePatch } from '../src/workbench/generationCanvas/store/nodeRunOutcome'
import { mergeRunRecord } from '../src/workbench/generationCanvas/store/runRecordHelpers'
import { createCanvasGroupSnapshot } from '../src/workbench/generationCanvas/model/canvasGroup'
import type { GenerationCanvasNode, GenerationCanvasSnapshot } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
import { projectDirById } from '../electron/projects/repository'
import { readWorkspaceManifest } from '../electron/workspace/workspaceManifest'
import { sameProjectAgentBinding } from '../electron/shared/projectBinding'
import i18n from '../src/i18n'
import { mutateWebProject, projectCanvas } from './projectState'

export type WebProductionProjectPortOptions = {
  documentId?: string
  beforeStoryboardWrite?: (current: ProjectRecord, input: Record<string, unknown>) => void
  readProject?: typeof readProject
  saveProject?: typeof saveProject
  mutateProject?: typeof mutateWebProject
  listModels?: () => Promise<AgentModelEntry[]>
  orderedVendors?: () => Promise<string[]>
  documentPreconditions?: PreconditionSet['document']
  assertBinding?: () => void
  onChange?: (projectId: string) => void
}

/** Existing project payload is the only durable creation state. No active browser store is borrowed. */
export function createWebProductionProjectPort(binding: ProjectBinding, options: WebProductionProjectPortOptions = {}) {
  const read = options.readProject ?? readProject
  const save = options.saveProject ?? saveProject
  const mutate = options.mutateProject ?? mutateWebProject
  const projectId = binding.projectId
  function record(): ProjectRecord {
    const current = read(projectId)
    if (!current) throw new SurfacePortWireError('surface_port_unavailable')
    // saveProject validates the immutable expectedBinding again at its actual write boundary.
    if (options.assertBinding) options.assertBinding()
    else {
      const directory = projectDirById(projectId)
      const identity = directory ? readWorkspaceManifest(directory) : null
      if (!identity?.immutableProjectUuid || !identity.projectGeneration || !sameProjectAgentBinding(binding, { projectId: identity.id, immutableProjectUuid: identity.immutableProjectUuid, projectGeneration: identity.projectGeneration })) throw new SurfacePortWireError('surface_port_stale')
    }
    return current
  }
  const admittedCanvas = projectCanvas(record())
  const admittedDocumentId = options.documentId ?? admittedCanvas.activeDocumentId
  const admittedDocument = admittedCanvas.workbenchDocuments?.find(value => value.id === admittedDocumentId)
  function admittedDocumentFor(current: ProjectRecord, requestedDocumentId = admittedDocumentId) {
    // One turn owns one admitted document. A later active editor or explicit selector
    // cannot grant this turn authority over a newly selected or newly created document.
    if (!admittedDocument || !admittedDocumentId || requestedDocumentId !== admittedDocumentId) throw new SurfacePortWireError('surface_port_stale')
    const selected = projectCanvas(current).workbenchDocuments?.find(value => value.id === admittedDocumentId)
    if (!selected) throw new SurfacePortWireError('surface_port_stale')
    return selected
  }
  async function persist(current: ProjectRecord, payload: ReturnType<typeof projectCanvas>, managed?: { documentId?: string; designId?: string }) {
    const previous = (projectCanvas(current) as ReturnType<typeof projectCanvas> & { webManagedCreation?: { documents: Record<string, true>; designs: Record<string, true> } }).webManagedCreation
    const next = managed ? { ...payload, webManagedCreation: { documents: { ...previous?.documents, ...(managed.documentId ? { [managed.documentId]: true } : {}) }, designs: { ...previous?.designs, ...(managed.designId ? { [managed.designId]: true } : {}) } } } : payload
    await save(projectId, { ...current, expectedBinding: binding, payload: next })
    options.onChange?.(projectId)
  }
  let expectedDocumentState = options.documentPreconditions ?? (admittedDocument ? documentSessionState(admittedDocument) : undefined)
  const documentPort: DocumentLanePort = {
    read: async (scope, context) => {
      context.signal.throwIfAborted()
      if (scope !== 'full') throw new SurfacePortWireError('capability_unsupported')
      const selected = admittedDocumentFor(record())
      expectedDocumentState = documentSessionState(selected)
      return { text: workbenchDocumentPlainText(selected) }
    },
    write: async (input, context) => mutate(projectId, async () => {
      context.signal.throwIfAborted()
      const current = record()
      const selected = admittedDocumentFor(current)
      assertDocumentWritePreconditions(expectedDocumentState, documentSessionState(selected))
      const next = applyWholeDocumentWrite(selected, input.operation, input.content)
      const payload = projectCanvas(current)
      await persist(current, { ...payload, workbenchDocuments: payload.workbenchDocuments!.map(value => value.id === selected.id ? next : value) }, { documentId: selected.id })
      expectedDocumentState = documentSessionState(next)
      return { applied: true, revision: next.updatedAt, contentHash: documentSessionState(next).contentHash }
    }),
  }
  async function writeDocument(input: DocumentSessionWriteInput) {
    return mutate(projectId, async () => {
      const current = record()
      const selected = admittedDocumentFor(current, input.target.kind === 'document' ? input.target.documentId : undefined)
      if (input.target.kind !== 'document' || input.target.anchor.kind !== 'whole-document') throw new SurfacePortWireError('capability_unsupported')
      assertDocumentWritePreconditions(input.preconditions.document, documentSessionState(selected))
      const next = applyWholeDocumentWrite(selected, input.operation, input.content)
      const payload = projectCanvas(current)
      await persist(current, { ...payload, workbenchDocuments: payload.workbenchDocuments!.map(value => value.id === selected.id ? next : value) }, { documentId: selected.id })
      return { applied: true as const, revision: next.updatedAt, contentHash: documentSessionState(next).contentHash }
    })
  }
  async function requestRenderer(op: string, value: unknown, _timeoutMs = 60000): Promise<unknown> {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    if (data.projectId !== undefined && data.projectId !== projectId) throw new SurfacePortWireError('surface_port_stale')
    if (op === 'document.read') {
      if (data.scope === 'selection') throw new SurfacePortWireError('capability_unsupported')
      return { text: workbenchDocumentPlainText(admittedDocumentFor(record(), typeof data.documentId === 'string' ? data.documentId : undefined)) }
    }
    if (op === 'document.write') return writeDocument(data as unknown as DocumentSessionWriteInput)
    return mutate(projectId, async () => {
      const current = record()
      const payload = projectCanvas(current)
      if (op === 'storyboard.upsert-design' || op === 'storyboard.patch-design') {
        options.beforeStoryboardWrite?.(current, data)
        const store = createStore<WorkbenchDocumentSlice & { persistRevision: number }>()(immer((set, get, api) => ({
          ...createWorkbenchDocumentSlice(set as Parameters<typeof createWorkbenchDocumentSlice>[0], get as Parameters<typeof createWorkbenchDocumentSlice>[1], api as Parameters<typeof createWorkbenchDocumentSlice>[2], () => {}),
          persistRevision: 0,
          workbenchDocuments: structuredClone(payload.workbenchDocuments ?? []),
          activeDocumentId: payload.activeDocumentId ?? '',
          storyboardDesignsByDocumentId: structuredClone(payload.storyboardDesignsByDocumentId ?? {}),
          activeStoryboardId: null,
        })))
        const authoring = createAgentStoryboardDesign({ getState: store.getState, assertProject: id => { if (id !== projectId) throw new SurfacePortWireError('surface_port_stale') } })
        const result = op === 'storyboard.upsert-design' ? authoring.upsertAgentStoryboardDesign(data) : authoring.patchAgentStoryboardDesign(data)
        const state = store.getState()
        await persist(current, { ...payload, storyboardDesignsByDocumentId: state.storyboardDesignsByDocumentId, activeDocumentId: state.activeDocumentId }, { designId: String(data.designId) })
        return result
      }
      if (op !== 'production.materialize-shots') throw new SurfacePortWireError('capability_unsupported')
      let canvas = structuredClone(payload.generationCanvas)
      const updateNode = (nodeId: string, patch: Partial<GenerationCanvasNode>) => { canvas.nodes = canvas.nodes.map(node => node.id === nodeId ? { ...node, ...patch } : node) }
      const getState = (): LandingCanvasState => ({
        nodes: canvas.nodes,
        groups: canvas.groups ?? [],
        updateNode,
        createGroup: (category, name, groupOptions) => {
          const next = createCanvasGroupSnapshot(canvas, category, name, groupOptions)
          canvas = next.snapshot
          return next.group
        },
        addNode: input => {
          const added = addNodes(normalizeSnapshot(canvas), [input])
          const node = added.snapshot.nodes.find(row => row.id === added.ids[0])! as unknown as GenerationCanvasNode
          node.meta = { ...node.meta, ...input.meta, isWebAgentCreated: true }
          if (input.categoryId) node.categoryId = input.categoryId
          canvas.nodes = [...canvas.nodes, node]
          return node
        },
        addNodeResult: (nodeId, result, mediaDimensions) => {
          const node = canvas.nodes.find(row => row.id === nodeId)
          if (node) updateNode(nodeId, nodeRunOutcomePatch(node, { kind: 'result', result, mediaDimensions }))
        },
        setNodeStatus: (nodeId, status, error) => {
          const node = canvas.nodes.find(row => row.id === nodeId)
          if (node) updateNode(nodeId, nodeRunOutcomePatch(node, { kind: 'status', status, error }))
        },
        appendNodeRun: (nodeId, run) => {
          const node = canvas.nodes.find(row => row.id === nodeId)
          const next = { ...run, id: run.id ?? randomUUID(), startedAt: run.startedAt ?? Date.now(), updatedAt: run.updatedAt ?? Date.now() }
          if (node) updateNode(nodeId, nodeRunOutcomePatch(node, { kind: 'run-started', run: next }))
          return next
        },
        trackNodeRun: (nodeId, runId, patch) => {
          const node = canvas.nodes.find(row => row.id === nodeId)
          const index = node?.runs?.findIndex(run => run.id === runId) ?? -1
          if (!node || index < 0) return
          const runs = [...node.runs!]
          runs[index] = mergeRunRecord(runs[index], patch)
          updateNode(nodeId, { runs, ...(index === 0 ? { status: runs[0].status === 'cancelled' ? 'idle' : runs[0].status, error: runs[0].error, progress: runs[0].progress } : {}) })
        },
      })
      const listModels = options.listModels ?? (async () => [])
      const landing = createMultiShotCanvasLanding({
        getState,
        listModels,
        orderedVendors: options.orderedVendors ?? (async () => []),
        translate: (key, params) => String(i18n.t(key, params)),
        adopt: async () => ({ binding, assertCurrent: () => { record() } }),
        interrupt: () => {},
        transaction: (_context, operation) => operation(),
        undoBarrier: () => {},
        resolveNodeId: clientId => canvas.nodes.find(node => node.meta?.materializationClientId === clientId)?.id ?? '',
        createNodes: async (args, _context, assertCurrent) => {
          assertCurrent()
          const inputs = args.nodes as Array<Record<string, unknown>>
          const entries = buildModelEntryIndex(await listModels(), await (options.orderedVendors?.() ?? Promise.resolve([])))
          const positioned = layoutStoryboardNodesWith(nodeKindFootprint, inputs.map(input => String(input.kind)), Number(args.anchorCount ?? 0), canvas.nodes)
          const createdNodeIds: string[] = []
          const clientIdToNodeId: Record<string, string> = {}
          for (const [index, input] of inputs.entries()) {
            const added = addNodes(normalizeSnapshot(canvas), [{ kind: String(input.kind), title: String(input.title), prompt: String(input.prompt), vendor: typeof input.vendor === 'string' ? input.vendor : undefined, modelKey: typeof input.modelKey === 'string' ? input.modelKey : undefined, x: positioned[index].x, y: positioned[index].y }])
            const node = added.snapshot.nodes.find(row => row.id === added.ids[0])! as unknown as GenerationCanvasNode
            node.meta = { ...node.meta, ...buildPlannedNodeMeta(input, entries), ...(input.metadata as Record<string, unknown>), ...(input.referenceSheet ? { referenceSheet: true } : {}), isWebAgentCreated: true }
            node.categoryId = 'shots'
            if (input.referenceSheet === true) delete node.shotIndex
            canvas.nodes = [...canvas.nodes, node]
            createdNodeIds.push(node.id)
            clientIdToNodeId[String(input.clientId)] = node.id
          }
          return { createdNodeIds, clientIdToNodeId }
        },
        persist: async () => persist(current, { ...payload, generationCanvas: canvas as GenerationCanvasSnapshot }),
      })
      return landing.materializeShots(data)
    })
  }
  return {
    documentPort,
    requestRenderer,
    readAdmittedDocumentState: () => expectedDocumentState ? structuredClone(expectedDocumentState) : undefined,
    readDocumentState: (documentId?: string) => documentSessionState(admittedDocumentFor(record(), documentId)),
    readDocument: (documentId?: string) => admittedDocumentFor(record(), documentId),
  }
}
