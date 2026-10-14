import { describe, expect, it } from 'vitest'
import { assertSourceStoryboardExecution } from './sourceStoryboardExecution'
import { storyboardPlanFromDraftSubjects } from '../electron/capabilityCore/mcpGenerationMultiShot'
const candidate = { candidateId: 'c', revision: 1, moduleId: 'generation.single-shot', providerId: 'comfyui:test', modelId: 'video', mode: 'image_to_video', prompt: 'A lantern sways', parameters: {}, references: [{ assetId: 'image', contentHash: 'hash', version: 1, kind: 'image' as const, role: 'first_frame' as const }] }
const subjects = [{ shotId: 'shot', candidate }]
const base = () => storyboardPlanFromDraftSubjects(subjects, 'project', () => 'http://localhost/image.png')
describe('source storyboard execution compiler', () => {
  it('accepts editorial structure with a pinned ready first-frame dependency', () => {
    const plan = base()
    Object.assign(plan.shots[0], { anchorIds: ['editorial'], promptSegments: [{ key: 'motion', start: 0, end: 8 }], keyframe: { enabled: true, prompt: 'A still lantern', modelKey: 'image-model' } })
    expect(() => assertSourceStoryboardExecution(plan, base(), subjects)).not.toThrow()
  })
  it('refuses enabled keyframes without a first-frame candidate rather than dropping image generation', () => {
    const noReference = [{ shotId: 'shot', candidate: { ...candidate, references: [] } }]
    const plan = storyboardPlanFromDraftSubjects(noReference, 'project')
    plan.shots[0].keyframe = { enabled: true, prompt: 'Still lantern' }
    expect(() => assertSourceStoryboardExecution(plan, plan, noReference)).toThrow('storyboard_keyframe_requires_first_frame')
  })
  it.each(['prompt', 'modelKey', 'params', 'referenceBindings'])('rejects execution drift in %s', field => {
    const plan = base()
    Object.assign(plan.shots[0], { [field]: field === 'params' ? { seed: 3 } : field === 'referenceBindings' ? { first_frame: [{ url: 'foreign' }] } : 'changed' })
    expect(() => assertSourceStoryboardExecution(plan, base(), subjects)).toThrow('storyboard_execution_conflict')
  })
})

it('retains a fixed-workflow editorial duration but rejects contradictory admitted duration knobs', () => {
  const fixed = base()
  fixed.shots[0].durationSec = 124 / 24
  expect(() => assertSourceStoryboardExecution(fixed, base(), subjects)).not.toThrow()
  const durationSubjects = [{ shotId: 'shot', candidate: { ...candidate, parameters: { duration: 5 } } }]
  const expected = storyboardPlanFromDraftSubjects(durationSubjects, 'project', () => 'http://localhost/image.png')
  const altered = structuredClone(expected)
  altered.shots[0].durationSec = 20
  expect(() => assertSourceStoryboardExecution(altered, expected, durationSubjects)).toThrow('storyboard_execution_conflict')
})
