import { describe, expect, it } from 'vitest'
import { createProject, readProject, saveProject } from '../electron/projects/repository'
import { createDefaultWorkbenchProjectPayload } from '../src/workbench/project/projectRecordSchema'
import { projectCanvas, saveWebProject } from './projectState'
import { synchronousSha256 } from '../electron/shared/synchronousSha256'
import { stableProjectAgentJson } from '../electron/shared/legacyAgentJson'
const hash = (value: unknown) => synchronousSha256(stableProjectAgentJson(JSON.parse(JSON.stringify(value))))
const content = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
async function fixture() {
  const payload = createDefaultWorkbenchProjectPayload()
  payload.workbenchDocuments = [{ id: 'script', version: 1, title: 'My script', updatedAt: 1, contentJson: content('Original') }]
  const project = createProject({ name: 'Creation save race', payload })
  const stale = readProject(project.id)!
  const currentPayload = { ...projectCanvas(stale), workbenchDocuments: [{ ...payload.workbenchDocuments[0], updatedAt: 2, contentJson: content('Agent draft') }], webManagedCreation: { documents: { script: true }, designs: {} } }
  await saveProject(project.id, { ...stale, payload: currentPayload })
  return { project, stale }
}
describe('creation drafts survive stale browser save snapshots', () => {
  it('keeps the new server draft when an old snapshot has not observed the write', async () => {
    const { project, stale } = await fixture()
    await saveWebProject(project.id, stale)
    expect(projectCanvas(readProject(project.id)!).workbenchDocuments![0].contentJson).toEqual(content('Agent draft'))
  })
  it('keeps the server content while accepting an independently edited human title', async () => {
    const { project, stale } = await fixture()
    const payload = projectCanvas(stale)
    const document = payload.workbenchDocuments![0]
    stale.payload = { ...payload, workbenchDocuments: [{ ...document, title: 'Human title' }], webAgentSeenCreation: { documents: { script: { contentHash: hash(document.contentJson), titleHash: hash(document.title) } }, designs: {} } }
    await saveWebProject(project.id, stale)
    expect(projectCanvas(readProject(project.id)!).workbenchDocuments![0]).toMatchObject({ title: 'Human title', contentJson: content('Agent draft') })
  })
  it('accepts actual manual content edits against a captured pre-agent snapshot', async () => {
    const { project, stale } = await fixture()
    const payload = projectCanvas(stale)
    const document = payload.workbenchDocuments![0]
    stale.payload = { ...payload, workbenchDocuments: [{ ...document, updatedAt: 3, contentJson: content('Human edit') }], webAgentSeenCreation: { documents: { script: { contentHash: hash(document.contentJson), titleHash: hash(document.title) } }, designs: {} } }
    await saveWebProject(project.id, stale)
    expect(projectCanvas(readProject(project.id)!).workbenchDocuments![0].contentJson).toEqual(content('Human edit'))
  })
})
