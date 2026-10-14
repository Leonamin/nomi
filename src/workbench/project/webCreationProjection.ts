import { z } from 'zod'
import { SurfacePortWireError } from '../../../electron/shared/surfacePortBinding'
import { stableProjectAgentJson } from '../../../electron/shared/legacyAgentJson'
import { synchronousSha256 } from '../../../electron/shared/synchronousSha256'
import type { StoryboardDesign, WorkbenchDocument } from '../workbenchTypes'

const pin = z.string().regex(/^[a-f0-9]{64}$/)
export const webCreationKnowledgeSchema = z.object({
  documents: z.record(z.object({ contentHash: pin, titleHash: pin }).strict()),
  designs: z.record(z.object({ planHash: pin, titleHash: pin }).strict()),
}).strict()
export type WebCreationKnowledge = z.infer<typeof webCreationKnowledgeSchema>
export const webManagedCreationSchema = z.object({ documents: z.record(z.literal(true)), designs: z.record(z.literal(true)) }).strict()
export type WebManagedCreation = z.infer<typeof webManagedCreationSchema>
export type WebCreationPayload = {
  workbenchDocuments?: WorkbenchDocument[]
  storyboardDesignsByDocumentId?: Record<string, StoryboardDesign[]>
  webManagedCreation?: WebManagedCreation
  webAgentSeenCreation?: WebCreationKnowledge
}
export function webCreationFieldHash(value: unknown): string {
  // Persisted project JSON strips undefined. Reuse the same canonical JSON/hash owners on both hosts.
  const persisted = JSON.parse(JSON.stringify(value ?? null)) as unknown
  return synchronousSha256(stableProjectAgentJson(persisted))
}
export function observeWebCreation(payload: WebCreationPayload): WebCreationKnowledge {
  return {
    documents: Object.fromEntries((payload.workbenchDocuments || []).map(doc => [doc.id, { contentHash: webCreationFieldHash(doc.contentJson), titleHash: webCreationFieldHash(doc.title) }])),
    designs: Object.fromEntries(Object.values(payload.storyboardDesignsByDocumentId || {}).flat().map(design => [design.id, { planHash: webCreationFieldHash(design.plan), titleHash: webCreationFieldHash(design.title) }])),
  }
}
function hasFieldEdit(incoming: unknown, observedHash: string | undefined): boolean {
  return Boolean(observedHash && webCreationFieldHash(incoming) !== observedHash)
}
/** Browser edits are deltas against its captured observation, not guesses against today's server data. */
export function mergeWebCreation(current: WebCreationPayload, incoming: WebCreationPayload, observed: WebCreationKnowledge = { documents: {}, designs: {} }): WebCreationPayload {
  const managed = current.webManagedCreation || { documents: {}, designs: {} }
  const incomingDocuments = new Map((incoming.workbenchDocuments || []).map(doc => [doc.id, doc]))
  const currentDocuments = new Map((current.workbenchDocuments || []).map(doc => [doc.id, doc]))
  const documents = (incoming.workbenchDocuments || []).filter(doc => {
    if (currentDocuments.has(doc.id) || !managed.documents[doc.id]) return true
    const known = observed.documents[doc.id]
    if (hasFieldEdit(doc.contentJson, known?.contentHash) || hasFieldEdit(doc.title, known?.titleHash)) throw new SurfacePortWireError('surface_port_stale')
    return false
  }).map(doc => {
    const saved = currentDocuments.get(doc.id)
    if (!saved || !managed.documents[doc.id]) return doc
    const known = observed.documents[doc.id]
    return { ...doc, contentJson: hasFieldEdit(doc.contentJson, known?.contentHash) ? doc.contentJson : saved.contentJson,
      title: hasFieldEdit(doc.title, known?.titleHash) ? doc.title : saved.title, updatedAt: Math.max(doc.updatedAt, saved.updatedAt) }
  })
  documents.push(...(current.workbenchDocuments || []).filter(doc => managed.documents[doc.id] && !incomingDocuments.has(doc.id) && !observed.documents[doc.id]))
  const currentDesigns = new Map(Object.values(current.storyboardDesignsByDocumentId || {}).flat().map(design => [design.id, design]))
  const incomingDesignIds = new Set(Object.values(incoming.storyboardDesignsByDocumentId || {}).flat().map(design => design.id))
  const designs: Record<string, StoryboardDesign[]> = Object.fromEntries(Object.entries(incoming.storyboardDesignsByDocumentId || {}).map(([documentId, rows]) => [documentId, rows.filter(design => {
    if (currentDesigns.has(design.id) || !managed.designs[design.id]) return true
    const known = observed.designs[design.id]
    if (hasFieldEdit(design.plan, known?.planHash) || hasFieldEdit(design.title, known?.titleHash)) throw new SurfacePortWireError('surface_port_stale')
    return false
  }).map(design => {
    const saved = currentDesigns.get(design.id)
    if (!saved || !managed.designs[design.id]) return design
    const known = observed.designs[design.id]
    const hasPlanEdit = hasFieldEdit(design.plan, known?.planHash)
    return { ...(hasPlanEdit ? design : saved), title: hasFieldEdit(design.title, known?.titleHash) ? design.title : saved.title, updatedAt: Math.max(design.updatedAt, saved.updatedAt) }
  })]))
  for (const saved of currentDesigns.values()) if (managed.designs[saved.id] && !incomingDesignIds.has(saved.id) && !observed.designs[saved.id]) {
    ;(designs[saved.documentId] ||= []).push(saved)
  }
  return { workbenchDocuments: documents, storyboardDesignsByDocumentId: designs, webManagedCreation: managed }
}
/** Apply only server fields still unchanged since the browser's last observation. */
export function projectWebCreation(local: WebCreationPayload, server: WebCreationPayload, observed: WebCreationKnowledge): WebCreationPayload {
  return mergeWebCreation(server, local, observed)
}
