import { describe, expect, it, vi } from 'vitest'
const { readSkills } = vi.hoisted(() => ({ readSkills: vi.fn().mockRejectedValue(new Error('Native skill runtime unavailable')) }))
vi.mock('../electron/skills/skillStore', () => ({ readSkillRecords: readSkills }))
vi.mock('../electron/hardenedFetch', () => ({ hardenedFetchText: vi.fn().mockRejectedValue(new Error('Offline')) }))
import { getBuiltinPrompts, withBuiltinPrompts } from '../electron/promptLibrary/builtinPacks'
import { getPromptLibrary } from '../electron/promptLibrary/promptLibraryStore'

describe('prompt composition for a host without skill execution', () => {
  it('serves manual builtins and external prompts without loading native skill catalogs', async () => {
    const options = { shouldIncludeSkillPrompts: false }
    const builtins = await getBuiltinPrompts(options)
    expect(builtins.length).toBeGreaterThan(0)
    expect((await withBuiltinPrompts([], options)).length).toBe(builtins.length)
    expect((await getPromptLibrary(options)).length).toBeGreaterThanOrEqual(builtins.length)
    expect(readSkills).not.toHaveBeenCalled()
  })
  it('keeps skill catalog composition as the default for existing desktop callers', async () => {
    await expect(getBuiltinPrompts()).rejects.toThrow('Native skill runtime unavailable')
    expect(readSkills).toHaveBeenCalledOnce()
  })
})
