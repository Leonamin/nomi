import { withProjectAction } from '../../project/projectCanvasReadSurface'
import { useWorkbenchStore } from '../../workbenchStore'
import { createAgentStoryboardDesign } from './agentStoryboardDesignCore'

const authoring = createAgentStoryboardDesign({
  getState: () => useWorkbenchStore.getState(),
  assertProject: projectId => {
    const project = withProjectAction(current => current, () => { throw new Error('storyboard_project_unavailable') })
    project.assertCurrent()
    if (project.binding.projectId !== projectId) throw new Error('storyboard_project_changed')
  },
})
export const upsertAgentStoryboardDesign = authoring.upsertAgentStoryboardDesign
export const patchAgentStoryboardDesign = authoring.patchAgentStoryboardDesign
