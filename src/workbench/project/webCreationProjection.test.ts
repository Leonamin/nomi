import { describe, expect, it } from 'vitest'
import { createDefaultWorkbenchProjectPayload } from './projectRecordSchema'
import { mergeWebCreation, observeWebCreation, projectWebCreation } from './webCreationProjection'
import type { StoryboardDesign } from '../workbenchTypes'
import { createEmptyStoryboardPlan } from '../generationCanvas/agent/storyboardPlan'
const fixture = () => {
  const initial = createDefaultWorkbenchProjectPayload()
  initial.workbenchDocuments![0].title = 'Original title'
  const doc = initial.workbenchDocuments![0]
  const design: StoryboardDesign = { id: 'design', documentId: doc.id, title: 'Original board', plan: createEmptyStoryboardPlan(), committed: false, status: 'draft', sourceDocumentUpdatedAt: doc.updatedAt, createdAt: 1, updatedAt: 1 }
  initial.storyboardDesignsByDocumentId = { [doc.id]: [design] }
  const server = { ...initial, workbenchDocuments: [{ ...doc, title: 'Agent title' }], storyboardDesignsByDocumentId: { [doc.id]: [{ ...design, title: 'Agent board', plan: { ...design.plan, title: 'New plan' }, updatedAt: 2 }] }, webManagedCreation: { documents: { [doc.id]: true as const }, designs: { design: true as const } } }
  return { initial, server, doc, design }
}
describe('creation observation is part of the exact save snapshot', () => {
  it('preserves unseen storyboard updates but keeps an independent human title edit', () => {
    const { initial, server, doc, design } = fixture()
    const observed = observeWebCreation(initial)
    const edited = { ...initial, storyboardDesignsByDocumentId: { [doc.id]: [{ ...design, title: 'Human board' }] } }
    expect(mergeWebCreation(server, edited, observed).storyboardDesignsByDocumentId![doc.id][0]).toMatchObject({ title: 'Human board', plan: { title: 'New plan' } })
  })
  it('preserves unseen additions and permits deletion only after that ID was observed', () => {
    const { initial, server, doc } = fixture()
    const empty = { ...initial, workbenchDocuments: [], storyboardDesignsByDocumentId: {} }
    expect(mergeWebCreation(server, empty).workbenchDocuments).toHaveLength(1)
    expect(mergeWebCreation(server, empty).storyboardDesignsByDocumentId![doc.id]).toHaveLength(1)
    const known = observeWebCreation(server)
    expect(mergeWebCreation(server, empty, known).workbenchDocuments).toEqual([])
    expect(mergeWebCreation(server, empty, known).storyboardDesignsByDocumentId).toEqual({})
  })
  it('keeps observed server deletions out of late browser saves and live projections', () => {
    const { server, doc } = fixture()
    const deleted = { ...server, workbenchDocuments: [], storyboardDesignsByDocumentId: {} }
    const observed = observeWebCreation(server)
    const merged = mergeWebCreation(deleted, server, observed)
    expect(merged.workbenchDocuments).toEqual([])
    expect(merged.storyboardDesignsByDocumentId![doc.id]).toEqual([])
    const projected = projectWebCreation(server, deleted, observed)
    expect(projected.workbenchDocuments).toEqual([])
    expect(projected.storyboardDesignsByDocumentId![doc.id]).toEqual([])
  })
  it('applies a server projection without changing a current manual edit', () => {
    const { initial, server, doc } = fixture()
    const edited = { ...initial, workbenchDocuments: [{ ...doc, title: 'Current human title' }] }
    const projected = projectWebCreation(edited, server, observeWebCreation(initial))
    expect(projected.workbenchDocuments![0].title).toBe('Current human title')
    expect(projected.storyboardDesignsByDocumentId![doc.id][0].title).toBe('Agent board')
  })
  it('leaves a queued snapshot pin unchanged when a newer projection is acknowledged', () => {
    const { initial, server } = fixture()
    const captured = observeWebCreation(initial)
    const before = structuredClone(captured)
    const acknowledged = observeWebCreation(server)
    expect(acknowledged).not.toEqual(captured)
    expect(captured).toEqual(before)
    expect(mergeWebCreation(server, initial, captured).workbenchDocuments![0].title).toBe('Agent title')
  })
})
