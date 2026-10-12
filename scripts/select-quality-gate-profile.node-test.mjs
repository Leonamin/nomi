import assert from 'node:assert/strict'
import test from 'node:test'

import { MANUAL_SURFACES, resolveProfileFromEnvironment } from './select-quality-gate-profile.mjs'

/** 哪一格面在某一档里是开着的（用于钉住「手动单面复跑只开一格」）。 */
function enabledSurfaces(policy) {
  return [
    policy.coreSmoke ? 'core-smoke' : null,
    policy.unit !== 'none' ? 'unit' : null,
    policy.desktop || policy.journeys ? 'e2e' : null,
    policy.canvas === 'full' ? 'canvas-acceptance' : null,
    policy.performance ? 'canvas-performance' : null,
    policy.package ? 'mac-package' : null,
  ].filter(Boolean)
}

test('manual single-surface recovery turns on exactly the named surface', () => {
  for (const surface of MANUAL_SURFACES) {
    if (surface === 'contracts') continue // contracts 没有档位开关，由 job 的 inputs.surfaces 条件管
    const policy = resolveProfileFromEnvironment({ NOMI_ONLY_SURFACE: surface, GITHUB_EVENT_NAME: 'workflow_dispatch' })
    assert.deepEqual(enabledSurfaces(policy), [surface], `${surface} 只该开自己那一格`)
    assert.equal(policy.onlySurface, surface, `${surface} 必须把自己报给 quality 那一步`)
    assert.equal(policy.reason, `manual_surface:${surface}`)
    assert.equal(policy.failClosed, false)
    assert.equal(policy.release, false, '手动复跑不是发布边界')
  }
})

test('"all" and non-dispatch events keep the shared classifier', () => {
  const all = resolveProfileFromEnvironment({ NOMI_ONLY_SURFACE: 'all', GITHUB_EVENT_NAME: 'pull_request' })
  assert.equal(all.onlySurface ?? '', '', '"all" 不是一次 subset，别把 only_surface 递给闸门')
  assert.notEqual(all.reason, 'manual_surface:all')
  const absent = resolveProfileFromEnvironment({ GITHUB_EVENT_NAME: 'pull_request' })
  assert.equal(absent.onlySurface ?? '', '')
})

test('an unknown surface name fails closed to the full profile instead of half a suite', () => {
  const policy = resolveProfileFromEnvironment({ NOMI_ONLY_SURFACE: 'everything', GITHUB_EVENT_NAME: 'workflow_dispatch' })
  assert.equal(policy.reason, 'unknown_manual_surface:everything')
  assert.equal(policy.onlySurface, '', '名字不认识就不许当 subset 放行')
  assert.deepEqual({ unit: policy.unit, desktop: policy.desktop, journeys: policy.journeys, canvas: policy.canvas, performance: policy.performance, package: policy.package }, {
    unit: 'full', desktop: true, journeys: true, canvas: 'full', performance: true, package: true,
  })
})
