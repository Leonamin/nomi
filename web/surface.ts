import { createCanvasReadSurfaceRegistry, createSurfaceOwnerAuthority } from '../electron/capabilityCore/canvasReadSurfaceRegistry'
import { projectDirById } from '../electron/projects/repository'
import { ensureWorkspaceProjectIdentity } from '../electron/workspace/workspaceProjectIdentity'
import { randomUUID } from 'node:crypto'

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
    id,
    registry,
    suspend: (input: { surfaceInstanceId: string }) => ({ ok: true, value: { suspension: registry.suspend(owner, input) } }),
    commit: async (input: { projectId: string; suspension: unknown }) => ({ ok: true, value: { binding: await registry.commitCanvasRead(owner, { projectId: input.projectId, suspension: registry.resolveSuspensionWire(owner, input.suspension) }) } }),
    release: (input: { authority: unknown }) => { registry.release(owner, { authority: registry.resolveReleaseWire(owner, input.authority) }); return { ok: true, value: { released: true } } },
  }
}

type Surface = ReturnType<typeof createWebSurface>
type Session = { surface: Surface; surfaceId: string; connections: number; timer?: ReturnType<typeof setTimeout> }
/** Browser authorities are leased; durable generation/export jobs never live in this pool. */
export class WebSurfaceSessions {
  private sessions = new Map<string, Session>()
  constructor(private createSurface: typeof createWebSurface = createWebSurface, private retireSurface: (surface: Surface) => void = () => undefined) {}
  get size() { return this.sessions.size }
  private entry(clientId: string, origin: string): Session {
    if (!/^[a-f0-9-]{36}$/.test(clientId)) throw new Error('Invalid browser session')
    let session = this.sessions.get(clientId)
    if (!session) {
      if (this.sessions.size >= 256) {
        const inactive = [...this.sessions].find(([, value]) => value.connections === 0)
        if (!inactive) throw new Error('Too many active browser tabs; close an unused tab')
        clearTimeout(inactive[1].timer); this.sessions.delete(inactive[0]); this.retireSurface(inactive[1].surface)
      }
      session = { surface: this.createSurface(origin), surfaceId: randomUUID(), connections: 0 }
      this.sessions.set(clientId, session)
    }
    if (session.connections === 0) this.scheduleExpiry(clientId, session)
    return session
  }
  private scheduleExpiry(clientId: string, session: Session) {
    clearTimeout(session.timer)
    session.timer = setTimeout(() => {
      if (session.connections === 0 && this.sessions.get(clientId) === session) { this.sessions.delete(clientId); this.retireSurface(session.surface) }
    }, 30_000)
    session.timer.unref()
  }
  get(clientId: string, origin: string): Surface { return this.entry(clientId, origin).surface }
  acquire(clientId: string, origin: string) {
    const session = this.entry(clientId, origin)
    session.connections++; clearTimeout(session.timer)
    let isReleased = false
    return { surface: session.surface, surfaceId: session.surfaceId, release: () => {
      if (isReleased) return
      isReleased = true; session.connections--
      if (session.connections === 0) this.scheduleExpiry(clientId, session)
    } }
  }
}
