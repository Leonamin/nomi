import { normalizeCustomCapabilityContract } from '../shared/customCapabilityContract'
import type { ImportedWorkflow } from './comfyuiWorkflowImport'
import { LEGACY_IMAGE_ROLE_PARAM_KEYS } from '../shared/imageCapabilities/comfyWorkflowInputRoles'

/** Bound controls and outputs, rather than the workflow's name, declare its capabilities. */
export function comfyWorkflowCapability(imported: ImportedWorkflow) {
  const groups = new Map<string, ImportedWorkflow['parameters']>()
  for (const control of imported.parameters.filter(control => control.type === 'image-url')) {
    const kind = control.mediaKind === 'video' ? 'video_ref' : control.mediaKind === 'audio' ? 'audio_ref'
      : control.key === LEGACY_IMAGE_ROLE_PARAM_KEYS.firstFrame ? 'first_frame'
      : control.key === LEGACY_IMAGE_ROLE_PARAM_KEYS.lastFrame ? 'last_frame' : 'image_ref'
    groups.set(kind, [...(groups.get(kind) || []), control])
  }
  return normalizeCustomCapabilityContract({ version: 1, kind: imported.kind, defaultModeId: imported.taskKind, transportTaskKind: imported.taskKind,
    modes: [{ id: imported.taskKind, transportTaskKind: imported.taskKind, intent: groups.has('first_frame') && groups.has('last_frame') ? 'firstlast' : imported.taskKind.startsWith('image_') ? imported.kind === 'video' ? 'single' : 'edit' : 'text',
      vendorTerm: 'ComfyUI workflow', hint: '', promptRequired: JSON.stringify(imported.templatedGraph).includes('{{request.prompt}}'),
      slots: [...groups].map(([kind, controls]) => ({ kind, label: controls.map(control => control.label).join(' / '), min: controls.length, max: controls.length,
        ...(controls.length === 1 ? { inputKey: controls[0].key } : {}) })),
      params: imported.parameters.filter(control => control.type !== 'image-url').map(control => ({ key: control.key, label: control.label, type: control.type,
        defaultValue: control.default, options: (control.options || []).map(value => ({ value, label: String(value) })) })),
    }],
  })
}
