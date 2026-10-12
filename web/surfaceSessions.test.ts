import { describe, expect, it, vi } from 'vitest'
import { WebSurfaceSessions } from './surface'

describe('browser surface leases', () => {
  it('reclaims disconnected pages across more than the session capacity', () => {
    const sessions = new WebSurfaceSessions(() => ({ registry: {} }) as never)
    for (let index = 0; index < 300; index++) {
      const lease = sessions.acquire(crypto.randomUUID(), 'http://localhost')
      lease.release()
    }
    expect(sessions.size).toBeLessThanOrEqual(256)
  })
  it('retains a live page and reuses its authority during transient reconnection', () => {
    vi.useFakeTimers()
    const sessions = new WebSurfaceSessions(() => ({ registry: {} }) as never)
    const clientId = crypto.randomUUID()
    const first = sessions.acquire(clientId, 'http://localhost')
    first.release()
    vi.advanceTimersByTime(1000)
    const second = sessions.acquire(clientId, 'http://localhost')
    expect(second.surfaceId).toBe(first.surfaceId)
    vi.advanceTimersByTime(60_000)
    expect(sessions.get(clientId, 'http://localhost')).toBe(second.surface)
    second.release()
    vi.advanceTimersByTime(30_001)
    expect(sessions.size).toBe(0)
    vi.useRealTimers()
  })
})
