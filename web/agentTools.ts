import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { readProject, saveProject } from '../electron/projects/repository'
import { readCatalog, listModelCatalogModels } from '../electron/catalog/catalogStore'
import { isComfyuiVendor } from '../electron/catalog/types'
import { addNodes, normalizeSnapshot } from '../electron/capabilityCore/canvasGraph'
import { buildCatalogTaskRequest } from '../src/workbench/generationCanvas/runner/catalogTaskActions'
import { appendEvents } from '../electron/events/eventLogRepository'
import { mutateWebProject, projectCanvas } from './projectState'
import type { WebGenerationJobs } from './generationJobs'
import type { GenerationCanvasNode } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
import type { ProjectBinding } from '../electron/shared/projectBinding'
import { resolveGenerationReferences } from '../src/workbench/generationCanvas/runner/generationReferenceResolver'

export type AgentTool = { name: string; description: string; schema: z.AnyZodObject; effect: 'read' | 'reversible_write' | 'paid'; run: (input: unknown) => Promise<unknown> }
function tool<S extends z.AnyZodObject>(spec: Omit<AgentTool, 'schema' | 'run'> & { schema: S; run: (input: z.infer<S>) => Promise<unknown> }): AgentTool {
  return { ...spec, run: input => spec.run(spec.schema.parse(input)) }
}
export function createAgentTools(binding: ProjectBinding, turnId: string, jobs: WebGenerationJobs): AgentTool[] {
  const projectId = binding.projectId
  const record = () => { const current = readProject(projectId); if (!current) throw new Error('Project no longer exists'); return current }
  const models = () => {
    const state = readCatalog()
    return listModelCatalogModels({ enabled: true }).filter(model => ['image', 'video'].includes(model.kind) && state.vendors.some(vendor => vendor.key === model.vendorKey && vendor.enabled && isComfyuiVendor(vendor) && vendor.authType === 'none'))
  }
  const generated = new Set<string>()
  return [
    tool({ name: 'nomi_project_read', effect: 'read', description: 'Read this project’s current shots, prompts, model bindings and candidates. This does not select a candidate or alter the timeline.', schema: z.object({}), run: async () => {
      const payload = projectCanvas(record())
      return { projectId, shots: payload.generationCanvas.nodes.map(node => ({ id: node.id, kind: node.kind, title: node.title, prompt: node.prompt, status: node.status, meta: node.meta, result: node.result })), timeline: payload.timeline }
    } }),
    tool({ name: 'nomi_models_list', effect: 'read', description: 'List registered, enabled local ComfyUI generation models. Use exactly these vendorKey/modelKey identities; never invent a model.', schema: z.object({}), run: async () => models().map(model => ({ vendorKey: model.vendorKey, modelKey: model.modelKey, kind: model.kind, name: model.labelZh, meta: model.meta })) }),
    tool({ name: 'nomi_shot_create', effect: 'reversible_write', description: 'Create one image or video shot on the existing canvas, with a real model identity. It does not generate. parameters may override the workflow’s exposed inputs.', schema: z.object({ kind: z.enum(['image', 'video']), title: z.string().max(200), prompt: z.string().max(16000), vendorKey: z.string(), modelKey: z.string(), parameters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional() }), run: async input => mutateWebProject(projectId, async () => {
      const current = record(); const payload = projectCanvas(current)
      const model = models().find(row => row.vendorKey === input.vendorKey && row.modelKey === input.modelKey && row.kind === input.kind)
      if (!model) throw new Error('Select an enabled model of the requested kind from nomi_models_list')
      const added = addNodes(normalizeSnapshot(payload.generationCanvas), [{ kind: input.kind, title: input.title, prompt: input.prompt, vendor: model.vendorKey, modelKey: model.modelKey }])
      const node = added.snapshot.nodes.find(row => row.id === added.ids[0])! as unknown as GenerationCanvasNode
      node.meta = { ...(model.meta as Record<string, unknown> || {}), ...node.meta, ...input.parameters, modelVendor: model.vendorKey, vendor: model.vendorKey, modelKey: model.modelKey, modelAlias: model.modelKey, isWebAgentCreated: true }
      await saveProject(projectId, { ...current, expectedBinding: binding, payload: { ...payload, generationCanvas: { ...payload.generationCanvas, nodes: [...payload.generationCanvas.nodes, node] } } })
      appendEvents(projectId, [{ id: randomUUID(), source: 'agent', txnId: turnId, type: 'canvas.node.added', payload: { node } }])
      return { nodeId: node.id, status: node.status }
    }) }),
    tool({ name: 'nomi_shot_generate', effect: 'paid', description: 'Generate an existing shot once, only when the user requested generation. Nomi confirms the GPU action according to the current policy. Returns a durable taskId; poll nomi_job_status. Never automatically regenerate or replace a timeline cut.', schema: z.object({ nodeId: z.string() }), run: async ({ nodeId }) => {
      if (generated.has(nodeId)) throw new Error('This turn already submitted this shot. Automatic regeneration is unavailable.')
      const canvas = projectCanvas(record()).generationCanvas
      const node = canvas.nodes.find(row => row.id === nodeId)
      if (!node) throw new Error('Shot not found')
      const references = resolveGenerationReferences(node, canvas)
      if (references.relayFromVideoUrl) throw new Error('This shot requires relay frame extraction; generate it from the canvas first')
      const built = buildCatalogTaskRequest(node, { idempotencyKey: `${turnId}:${nodeId}`, references })
      generated.add(nodeId)
      return jobs.submit({ ...built, request: { ...built.request, extras: { ...built.request.extras, projectId, nodeId, idempotencyKey: `${turnId}:${nodeId}` } } })
    } }),
    tool({ name: 'nomi_job_status', effect: 'read', description: 'Read a previously submitted generation task in this project. succeeded includes the actual media assets. No resubmission occurs.', schema: z.object({ taskId: z.string() }), run: async ({ taskId }) => jobs.result({ taskId, projectId }) }),
  ]
}
