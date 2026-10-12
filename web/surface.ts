import { createCanvasReadSurfaceRegistry, createSurfaceOwnerAuthority } from '../electron/capabilityCore/canvasReadSurfaceRegistry'
import { projectDirById } from '../electron/projects/repository'
import { ensureWorkspaceProjectIdentity } from '../electron/workspace/workspaceProjectIdentity'

let nextOwnerId = 1
export function createWebSurface(origin: string) {
  const ownerAuthority = createSurfaceOwnerAuthority()
  const id = nextOwnerId++
  const owner = ownerAuthority.capture({ contents: {}, frame: {}, webContentsId: id, processId: process.pid, frameRoutingId: id, origin, isLive: () => true })
  const registry = createCanvasReadSurfaceRegistry({ ownerAuthority, resolveProjectIdentity: async projectId => {
    const dir = projectDirById(projectId)
    if (!dir) throw new Error('Project not found')
    return ensureWorkspaceProjectIdentity(dir)
  } })
  return {
    registry,
    suspend: (input: { surfaceInstanceId: string }) => ({ ok: true, value: { suspension: registry.suspend(owner, input) } }),
    commit: async (input: { projectId: string; suspension: unknown }) => ({ ok: true, value: { binding: await registry.commitCanvasRead(owner, { projectId: input.projectId, suspension: registry.resolveSuspensionWire(owner, input.suspension) }) } }),
    release: (input: { authority: unknown }) => { registry.release(owner, { authority: registry.resolveReleaseWire(owner, input.authority) }); return { ok: true, value: { released: true } } },
  }
}
