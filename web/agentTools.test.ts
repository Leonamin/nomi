import { describe, expect, it, vi } from 'vitest'
import { createProject, readProject } from '../electron/projects/repository'
import { projectCanvas, preserveUnseenAgentNodes } from './projectState'
import { createDefaultWorkbenchProjectPayload } from '../src/workbench/project/projectRecordSchema'
import { ensureWorkspaceProjectIdentity } from '../electron/workspace/workspaceProjectIdentity'
import { projectDirById } from '../electron/projects/repository'
import type { WebGenerationJobs } from './generationJobs'
const model = vi.hoisted(() => ({ vendorKey: 'comfyui-local-tools', modelKey: 'video-workflow', kind: 'video', enabled: true, labelZh: 'Local workflow', meta: {} }))
vi.mock('../electron/catalog/catalogStore', () => ({ readCatalog: () => ({ vendors: [{ key: model.vendorKey, enabled: true, authType: 'none' }] }), listModelCatalogModels: () => [model] }))
import { createAgentTools } from './agentTools'
describe('native agents write through Nomi owners', () => {
  it('creates a canonical numbered shot and submits it only once through the durable job owner', async () => {
    const project = createProject({ name: 'Agent canonical shot', payload: createDefaultWorkbenchProjectPayload() })
    const jobs = { submit: vi.fn().mockResolvedValue({ id: 'real-receipt-shape', status: 'queued' }) } as unknown as WebGenerationJobs
    const identity = await ensureWorkspaceProjectIdentity(projectDirById(project.id)!)
    const tools = createAgentTools({ projectId: project.id, immutableProjectUuid: identity.immutableProjectUuid, projectGeneration: identity.projectGeneration }, 'turn', jobs)
    const created = await tools.find(tool => tool.name === 'nomi_shot_create')!.run({ kind: 'video', title: 'Requested shot', prompt: 'A cat walks', vendorKey: model.vendorKey, modelKey: model.modelKey }) as { nodeId: string }
    const node = projectCanvas(readProject(project.id)!).generationCanvas.nodes.find(node => node.id === created.nodeId)!
    expect(node).toMatchObject({ kind: 'video', status: 'idle', categoryId: 'shots', shotIndex: 1, meta: { modelVendor: model.vendorKey, modelKey: model.modelKey } })
    const generate = tools.find(tool => tool.name === 'nomi_shot_generate')!
    await generate.run({ nodeId: node.id })
    await expect(generate.run({ nodeId: node.id })).rejects.toThrow('already submitted')
    expect(jobs.submit).toHaveBeenCalledOnce()
    expect(jobs.submit).toHaveBeenCalledWith(expect.objectContaining({ vendor: model.vendorKey, request: expect.objectContaining({ extras: expect.objectContaining({ projectId: project.id, nodeId: node.id }) }) }))
  })
  it('preserves additions unseen by a stale browser but permits deletion after that browser acknowledges them', () => {
    const node = { id: 'agent-new', kind: 'video', title: 'New', position: { x: 0, y: 0 }, meta: { isWebAgentCreated: true } } as const
    expect(preserveUnseenAgentNodes([node], [], new Set())).toEqual([node])
    expect(preserveUnseenAgentNodes([node], [], new Set([node.id]))).toEqual([])
  })
})
