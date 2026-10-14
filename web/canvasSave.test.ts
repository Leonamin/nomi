import { describe, expect, it } from 'vitest'
import { createProject, readProject, saveProject } from '../electron/projects/repository'
import { createProductionShotTable } from '../electron/shared/canvas/shotTable'
import { createDefaultWorkbenchProjectPayload } from '../src/workbench/project/projectRecordSchema'
import { projectCanvas, saveWebProject } from './projectState'
import type { GenerationCanvasNode, NodeGroup } from '../src/workbench/generationCanvas/model/generationCanvasTypes'
const shot: GenerationCanvasNode = { id: 'shot', kind: 'video', title: 'Shot', position: { x: 1, y: 2 }, prompt: 'Agent prompt', meta: { isWebAgentCreated: true, materializationOperationId: 'canvas-landing:run', materializationClientId: 'shot' }, groupId: 'group' }
const table: GenerationCanvasNode = { ...shot, id: 'table', kind: 'shot_table', title: 'Shot table', meta: { isWebAgentCreated: true, shotTable: createProductionShotTable('run', 'canvas-landing:run') } }
const group: NodeGroup = { id: 'group', name: 'Run group', categoryId: 'shots', nodeIds: ['shot', 'table'], materializationOperationId: 'canvas-landing:run', createdAt: 1, updatedAt: 1 }
export async function canvasFixture() {
  const initial = createDefaultWorkbenchProjectPayload()
  const project = createProject({ name: 'Canvas observation race', payload: initial })
  const stale = readProject(project.id)!
  const payload = projectCanvas(stale)
  await saveProject(project.id, { ...stale, payload: { ...payload, generationCanvas: { ...payload.generationCanvas, nodes: [shot, table], groups: [group] } } })
  return { project, stale }
}
describe('server-authored canvas persistence', () => {
  it('keeps a complete unseen production group and shot table through a stale browser save', async () => {
    const { project, stale } = await canvasFixture()
    await saveWebProject(project.id, stale)
    const saved = projectCanvas(readProject(project.id)!).generationCanvas
    expect(saved.nodes.map(node => node.id)).toEqual(['shot', 'table'])
    expect(saved.groups).toEqual([group])
  })
})
