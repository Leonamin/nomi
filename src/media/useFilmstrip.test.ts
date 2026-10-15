import { describe, expect, it, vi } from 'vitest'
import { resolveFilmstripRequest } from './useFilmstrip'

describe('resolveFilmstripRequest', () => {
  it('uses the project encoded in a cross-project local asset URL', () => {
    const videoUrl = 'nomi-local://asset/project%20a/assets/generated/video.mp4'

    expect(resolveFilmstripRequest(videoUrl, {
      explicitProjectId: 'project-b',
      activeProjectId: 'project-c',
    })).toEqual({
      videoUrl,
      projectId: 'project a',
      key: `project a::${videoUrl}`,
    })
  })
  it('keeps source-project ownership when Web transport delivered a same-origin media URL', () => {
    vi.stubGlobal('location', { origin: 'https://nomi.example' })
    try {
      const videoUrl = 'https://nomi.example/api/media/project%20a/assets/generated/video.mp4'
      expect(resolveFilmstripRequest(videoUrl, { activeProjectId: 'project-b' })).toMatchObject({ videoUrl, projectId: 'project a' })
      expect(resolveFilmstripRequest('https://other.example/api/media/project%20a/assets/generated/video.mp4', { activeProjectId: 'project-b' })?.projectId).toBe('project-b')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('falls back from an explicit project to the active project for non-local URLs', () => {
    expect(resolveFilmstripRequest('https://cdn.test/video.mp4', {
      explicitProjectId: 'project-b',
      activeProjectId: 'project-c',
    })?.projectId).toBe('project-b')

    expect(resolveFilmstripRequest('https://cdn.test/video.mp4', {
      activeProjectId: 'project-c',
    })?.projectId).toBe('project-c')
  })

  it('rejects an empty URL or a request with no usable project', () => {
    expect(resolveFilmstripRequest('', { activeProjectId: 'project-c' })).toBeNull()
    expect(resolveFilmstripRequest('https://cdn.test/video.mp4', {})).toBeNull()
  })
})
