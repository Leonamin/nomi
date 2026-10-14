import { isDeepStrictEqual } from 'node:util'
import { CUSTOM_CAPABILITY_CONTRACT_META_KEY } from '../shared/customCapabilityContract'
import { buildImportedWorkflow, normalizeWorkflowBinding, parseComfyApiWorkflow, type ImportedWorkflow } from './comfyuiWorkflowImport'
import { comfyWorkflowCapability } from './comfyuiWorkflowCapabilities'
import { isComfyuiVendor, type CatalogState } from './types'
import { isJsonRecord } from '../jsonUtils'

/** Only matching native generated mappings prove a legacy declaration. Explicit contracts win. */
export function migrateComfyWorkflowCapabilities(state: CatalogState): CatalogState {
  return { ...state, models: state.models.map(model => {
    if (!isComfyuiVendor({ key: model.vendorKey }) || !isJsonRecord(model.meta) || model.meta[CUSTOM_CAPABILITY_CONTRACT_META_KEY] !== undefined) return model
    const draft = model.meta.comfyWorkflowImport
    if (!isJsonRecord(draft) || typeof draft.text !== 'string' || !isJsonRecord(draft.binding)) return model
    try {
      const graph = parseComfyApiWorkflow(draft.text)
      const built = buildImportedWorkflow(graph, normalizeWorkflowBinding(draft.binding, graph))
      const mapping = state.mappings.find(row => row.vendorKey === model.vendorKey && row.modelKey === model.modelKey && row.taskKind === built.taskKind
        && row.create.request_transform === 'comfyui-prompt' && row.query?.response_transform === 'comfyui-history'
        && isJsonRecord(row.create.body) && isDeepStrictEqual(row.create.body.prompt, built.templatedGraph))
      const controls = model.meta.parameters
      if (!mapping || built.kind !== model.kind || !Array.isArray(controls)) return model
      // Preserve saved enums/defaults while proving every control still belongs to a bound input.
      if (controls.length !== built.parameters.length || !built.parameters.every(control => controls.some(saved => isJsonRecord(saved)
        && saved.key === control.key && (saved.type === control.type || control.type === 'text' && saved.type === 'select')))) return model
      const contract = comfyWorkflowCapability({ ...built, parameters: controls as ImportedWorkflow['parameters'] })
      return contract ? { ...model, meta: { ...model.meta, [CUSTOM_CAPABILITY_CONTRACT_META_KEY]: contract } } : model
    } catch { return model }
  }) }
}
