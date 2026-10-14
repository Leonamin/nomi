import { migrateCatalogForward } from './catalogMigrations'
import { describe, expect, it } from 'vitest'
import { analyzeComfyWorkflow, buildImportedWorkflow, buildComfyImportModelMapping } from './comfyuiWorkflowImport'
import { migrateComfyWorkflowCapabilities } from './comfyuiWorkflowCapabilityMigration'
import { comfyWorkflowCapability } from './comfyuiWorkflowCapabilities'
import { resolveArchetypeForModel } from '../shared/modelArchetypes'
import { buildVideoModelCandidates } from '../shared/videoCapabilities'
import type { CatalogState } from './types'
const graph = { '1': { class_type: 'CLIPTextEncode', inputs: { text: 'A quiet scene' } }, '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] } } }
describe('workflow capabilities have one bound-input declaration', () => {
  it('exposes imported image and video controls through original model profiles', () => {
    const image = buildImportedWorkflow(graph, analyzeComfyWorkflow(graph).suggested)
    const video = { ...image, kind: 'video' as const, taskKind: 'text_to_video' as const }
    for (const imported of [image, video]) {
      const { model } = buildComfyImportModelMapping(imported, { modelKey: `custom-${imported.kind}`, labelZh: 'Workflow' })
      expect(resolveArchetypeForModel({ modelKey: String(model.modelKey), vendorKey: String(model.vendorKey), meta: model.meta as Record<string, unknown> })).toMatchObject({ kind: imported.kind, defaultModeId: imported.taskKind })
    }
    const contract = comfyWorkflowCapability(video)
    expect(buildVideoModelCandidates([{ provider: 'comfyui-local', modelKey: 'custom-video', label: 'Workflow', meta: { customCapabilityContract: contract } }])[0].archetype.defaultModeId).toBe('text_to_video')
  })
  it('advances a real v13 catalog through the original migration writer without rewriting mappings', () => {
    const binding = analyzeComfyWorkflow(graph).suggested
    const imported = buildImportedWorkflow(graph, binding)
    const created = buildComfyImportModelMapping(imported, { modelKey: 'legacy-native', labelZh: 'Workflow', draft: { text: JSON.stringify(graph), binding } })
    const model = created.model as unknown as CatalogState['models'][number]
    delete (model.meta as Record<string, unknown>).customCapabilityContract
    const original = { version: 13, vendors: [], models: [model], mappings: [created.mapping], apiKeysByVendor: {} } as unknown as CatalogState
    const writes: CatalogState[] = []
    const migrated = migrateCatalogForward(original, () => { throw new Error('Unexpected missing catalog') }, state => { writes.push(state); return state })
    expect(migrated.version).toBe(14)
    expect(writes).toHaveLength(1)
    expect(writes[0].mappings).toBe(original.mappings)
    expect(migrated.models[0].meta).toMatchObject({ customCapabilityContract: { kind: 'image', defaultModeId: 'text_to_image' } })
    expect(original.models[0].meta).not.toHaveProperty('customCapabilityContract')
  })
  it('migrates only provably generated mappings and preserves user controls and explicit contracts', () => {
    const binding = analyzeComfyWorkflow(graph).suggested
    const built = buildImportedWorkflow(graph, binding)
    const result = buildComfyImportModelMapping(built, { modelKey: 'old-workflow', labelZh: 'Original', draft: { text: JSON.stringify(graph), binding } })
    const model = result.model as unknown as CatalogState['models'][number]
    delete (model.meta as Record<string, unknown>).customCapabilityContract
    const state = { version: 13, vendors: [], models: [model], mappings: [result.mapping], apiKeysByVendor: {} } as unknown as CatalogState
    const migrated = migrateComfyWorkflowCapabilities(state)
    expect(resolveArchetypeForModel(migrated.models[0])).toMatchObject({ kind: 'image' })
    expect(migrated.mappings).toBe(state.mappings)
    expect((migrated.models[0].meta as Record<string, unknown>).parameters).toEqual((model.meta as Record<string, unknown>).parameters)
    expect(migrateComfyWorkflowCapabilities(migrated).models[0]).toBe(migrated.models[0])
    const edited = structuredClone(state)
    edited.mappings[0].create.body = { prompt: { custom: true } }
    expect(migrateComfyWorkflowCapabilities(edited).models[0]).toBe(edited.models[0])
  })
})
