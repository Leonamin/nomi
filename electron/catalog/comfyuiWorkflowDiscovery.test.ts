import { describe, expect, it } from 'vitest'
import { analyzeComfyWorkflow, buildImportedWorkflow, buildComfyImportModelMapping } from './comfyuiWorkflowImport'
import { resolveArchetypeForModel } from '../shared/modelArchetypes'
const graph = { '1': { class_type: 'CLIPTextEncode', inputs: { text: 'A quiet scene' } }, '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] } } }
describe('imported workflow discovery compatibility', () => {
  it('gives arbitrary imported names their declared image capability', () => {
    const imported = buildImportedWorkflow(graph, analyzeComfyWorkflow(graph).suggested)
    const { model } = buildComfyImportModelMapping(imported, { modelKey: 'my-independent-workflow', labelZh: 'Workflow' })
    expect(resolveArchetypeForModel({ modelKey: String(model.modelKey), vendorKey: String(model.vendorKey), meta: model.meta as Record<string, unknown> })).toMatchObject({ kind: 'image', defaultModeId: 'text_to_image' })
  })
})
