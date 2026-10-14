import { describe, expect, it, vi } from 'vitest'
import { prepareWebCreationContext } from './creationContext'
import type { SkillRecord } from '../electron/skills/skillStore'
describe('web installed creation skill authority', () => {
  const skill = { name: 'storyboard', contentHash: 'installed-hash' } as SkillRecord
  it('uses canonical installed skill and renderer preparation instead of untrusted prompt bytes', async () => {
    const skills = { resolve: vi.fn(async () => skill), render: vi.fn(async () => 'canonical rendered skill') }
    expect(await prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, skillKey: 'storyboard', expectedSkillHash: 'installed-hash' }, skills)).toMatchObject({ skillPrompt: 'canonical rendered skill', skillSnapshot: { name: 'storyboard', contentHash: 'installed-hash' } })
    expect(skills.resolve).toHaveBeenCalledWith('storyboard')
    await expect(prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, skillPrompt: 'forged installed content' }, skills)).rejects.toThrow()
  })
  it('derives the admission surface from the current target rather than caller authority', async () => {
    const context = await prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, documentId: 'script', target: { kind: 'document', documentId: 'script', anchor: { kind: 'whole-document' } } })
    expect(context.admissionSurface).toBe('document')
    await expect(prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, admissionSurface: 'document' })).rejects.toThrow()
  })
  it('rejects stale skill versions and missing installed skills across any key', async () => {
    const skills = { resolve: async () => skill, render: async () => 'installed' }
    await expect(prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, skillKey: 'storyboard', expectedSkillHash: 'old-hash' }, skills)).rejects.toThrow('agent_skill_version_changed')
    await expect(prepareWebCreationContext({ approvalPolicy: { mode: 'step', spend: 'confirm' }, skillKey: 'missing' }, { ...skills, resolve: async () => null })).rejects.toThrow('agent_skill_unavailable')
  })
})
