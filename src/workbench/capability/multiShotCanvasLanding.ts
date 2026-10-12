import { whenProjectAdopted, withProjectAction, isProjectExecutionContextCurrent } from '../project/projectCanvasReadSurface'
import i18n from '../../i18n'
import { useGenerationCanvasStore } from '../generationCanvas/store/generationCanvasStore'
import { applyCanvasToolCall, resolveCanvasToolNodeId } from '../generationCanvas/agent/applyCanvasToolCall'
import { listAvailableModelsForAgent } from '../generationCanvas/agent/availableModels'
import { getVendorPreference } from '../api/vendorPreferenceApi'
import { withCanvasGestureContext } from '../generationCanvas/events/canvasGestureContext'
import { pushUndoSnapshot } from '../generationCanvas/events/canvasUndoJournal'
import { interruptPendingCanvasWrite } from '../generationCanvas/events/canvasWriteBoundary'
import { persistActiveWorkbenchProjectNow } from '../project/workbenchProjectSession'
import { createMultiShotCanvasLanding } from './multiShotCanvasLandingCore'
export type { MaterializeShotCandidate, MaterializeShotGeneration, MaterializeShotInput, MaterializeShotsPayload, MaterializeShotsResult, AttachShotResultPayload, AttachShotResultOutcome } from './multiShotCanvasLandingCore'

const landing = createMultiShotCanvasLanding({
  getState: () => useGenerationCanvasStore.getState(),
  listModels: () => listAvailableModelsForAgent(),
  orderedVendors: async () => (await getVendorPreference()).orderedVendorKeys,
  translate: (key, params) => String(i18n.t(key, params)),
  adopt: (timeout, shouldWaitForAdoption) => {
    const current = withProjectAction(project => project)
    return shouldWaitForAdoption ? whenProjectAdopted(timeout).then(project => project ?? null) : Promise.resolve(current ?? null)
  },
  interrupt: () => interruptPendingCanvasWrite(),
  transaction: (context, operation) => withCanvasGestureContext(context, operation),
  undoBarrier: () => pushUndoSnapshot(),
  resolveNodeId: clientId => resolveCanvasToolNodeId(clientId),
  createNodes: async (args, context, assertCurrent) => {
    const project = withProjectAction(current => current)
    if (!project) throw new Error('storyboard_project_unavailable')
    return applyCanvasToolCall('create_canvas_nodes', args, context, () => isProjectExecutionContextCurrent(project), undefined, undefined, async () => assertCurrent())
  },
  persist: () => persistActiveWorkbenchProjectNow(),
})
export const materializeShots = landing.materializeShots
export const attachShotResult = landing.attachShotResult
export const handleMultiShotCanvasLandingOp = landing.handleMultiShotCanvasLandingOp
