import { describe, expect, it } from 'vitest'
import { installLabLane, labHostState } from './agentPanelV4LabHost'
import { resolveLaneBridge } from '../../../workbench/ai/lane/laneClient'

describe('design lab desktop host identity', () => {
  it('advertises the same read-only projection bridge the specimen consumes', async () => {
    const host: Parameters<typeof installLabLane>[1] = {}
    const snapshot = labHostState({ items: [] })
    const dispose = installLabLane(snapshot, host)
    const bridge = resolveLaneBridge(host)
    expect(bridge).toBeDefined()
    const received: unknown[] = []
    bridge!.onProjection(value => received.push(value))
    expect(received).toEqual([snapshot])
    // The fixture rejects every command rather than opening a real host or spending.
    expect(await bridge!.send({} as never)).toMatchObject({ ok: false, code: 'agent_lane_bridge_absent' })
    dispose()
    expect(host.nomiDesktop).toBeUndefined()
  })

  it('preserves and restores an existing desktop host rather than overwriting other capabilities', () => {
    const previous = { agentLane: undefined, browser: { isFixture: true } }
    const host = { nomiDesktop: previous }
    const dispose = installLabLane(labHostState({ items: [] }), host)
    expect(host.nomiDesktop.browser).toBe(previous.browser)
    expect(resolveLaneBridge(host)).toBeDefined()
    dispose()
    expect(host.nomiDesktop).toBe(previous)
  })
})
