import { createHash } from 'node:crypto'
import { GENERATION_ARGUMENT_REFUSAL, refuseToModel } from '../electron/capabilityCore/transportFailure'
import type { StoryboardPlan } from '../electron/shared/storyboard/storyboardPlan'
import type { GenerationOperationDraftShot } from '../electron/capabilityCore/mcpGenerationMultiShot'
import { compileShotOutbound } from '../electron/shared/storyboard/storyboardPromptCompiler'
import { stableProjectAgentJson } from '../electron/shared/legacyAgentJson'

export function sourceStoryboardHash(plan: StoryboardPlan): string {
  return createHash('sha256').update(stableProjectAgentJson(JSON.parse(JSON.stringify(plan)))).digest('hex')
}

export function assertSourceStoryboardExecution(plan: StoryboardPlan, expected: StoryboardPlan, subjects: readonly Pick<GenerationOperationDraftShot, 'shotId' | 'candidate'>[]): void {
  // Only declared provider parameters control execution duration; authored row duration also serves timeline layout.
  const durations = new Map(expected.shots.map(shot => [shot.shotId, shot.params?.duration]))
  const projection = (value: StoryboardPlan) => ({
    anchors: value.anchors,
    shots: value.shots.map(shot => {
      const outbound = compileShotOutbound(shot, 'shot')
      const duration = durations.get(shot.shotId)
      return { shotId: shot.shotId, shotKind: shot.shotKind ?? 'image', modelKey: shot.modelKey ?? null,
        modelVendor: shot.modelVendor ?? null, modeId: shot.modeId ?? null, params: shot.params ?? {},
        ...(typeof duration === 'number' && Number.isFinite(duration) ? { durationSec: shot.durationSec } : {}),
        prompt: outbound.prompt, referenceBindings: Object.fromEntries(Object.entries(outbound.referenceBindings).map(([slot, bindings]) => [slot, bindings.map(binding => binding.url)])) }
    }),
  })
  if (stableProjectAgentJson(projection(plan)) !== stableProjectAgentJson(projection(expected))) throw new Error('storyboard_execution_conflict')
  for (const shot of plan.shots) {
    if (!shot.keyframe?.enabled) continue
    const candidate = subjects.find(subject => subject.shotId === shot.shotId)?.candidate
    if (!candidate || candidate.mode !== 'image_to_video' || !candidate.references.some(reference => reference.role === 'first_frame' && reference.kind === 'image')) {
      refuseToModel(GENERATION_ARGUMENT_REFUSAL, 'storyboard_keyframe_requires_first_frame: generate and review the keyframe image first, then pin its project asset as first_frame and approve image_to_video')
    }
  }
}
