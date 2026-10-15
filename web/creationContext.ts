import { parseLaneComposerContext } from '../electron/agentLane/laneDesktopInput'
import { prepareLaneSkillContext } from '../electron/agentLane/laneInputPreparation'
import { findSkillRecord, type SkillRecord } from '../electron/skills/skillStore'
import { nativeSkillLoader } from './nativeSkillLoader'
import { NOMI_AGENT_IDENTITY, composeAgentSystemPrompt } from '../electron/harness/context/agentContext'
import type { LaneComposerContext } from '../electron/shared/agentLane/laneDesktopContracts'
import { formatAgentContextSnapshot } from '../electron/shared/agentContextSnapshot'
import { formatStoryboardRequestTarget } from '../electron/shared/agentCapabilities/generationInvocationContext'
import { formatAvailableModelsForPrompt } from '../electron/shared/agentCapabilities/availableModels'
type Skills = Parameters<typeof prepareLaneSkillContext>[1]
/** Picker projection and creation preparation read the same native discovery. */
export const readWebSkillRecords = (): Promise<SkillRecord[]> => nativeSkillLoader().readSkillRecords()
function installedSkills(): Skills {
  const native = nativeSkillLoader()
  return { resolve: async key => findSkillRecord(key, '', await native.readSkillRecords()), render: native.renderSelectedSkillPrompt }
}
export async function prepareWebCreationContext(wire: unknown, skills?: Skills): Promise<LaneComposerContext> {
  const parsed = parseLaneComposerContext(wire)
  const context = { ...parsed, ...(parsed.target ? { admissionSurface: parsed.target.kind } : {}) }
  if (context.attachments?.length) throw new Error('Native web creation does not yet accept attachments')
  return prepareLaneSkillContext(context, context.skillKey ? skills || installedSkills() : { resolve: async () => null, render: async () => '' })
}
export function webCreationSystemPrompt(context: LaneComposerContext): string {
  return [composeAgentSystemPrompt({ identity: NOMI_AGENT_IDENTITY, panelSystemPrompt: context.systemPrompt || '', skillSystemPrompt: context.skillPrompt || '', memoryBlock: '' }),
    formatAgentContextSnapshot(context.contextSnapshot), formatStoryboardRequestTarget(context.storyboardTarget), formatAvailableModelsForPrompt(context.availableModels || [])].filter(Boolean).join('\n\n')
}
