import { describe, expect, it } from 'vitest'
import { createProject } from '../electron/projects/repository'
import { createWebSurface } from './surface'
import { dispatchWebRpc } from './rpc'

describe('web owned inline media import', () => {
  it('persists inline bytes through the existing asset owner and rejects foreign ownership or network URLs', async () => {
    const project = createProject({ name: 'Web inline media contract' })
    const surface = createWebSurface('http://localhost')
    const suspension = surface.suspend({ surfaceInstanceId: crypto.randomUUID() }).value.suspension
    await surface.commit({ projectId: project.id, suspension })
    const payload = { projectId: project.id, url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=', fileName: 'inline.png' }
    const result = await dispatchWebRpc('nomi:assets:import-remote-url', [payload], surface) as { ok: boolean; asset: { data: { url: string } } }
    expect(result.ok).toBe(true)
    expect(result.asset.data.url).toContain(`nomi-local://asset/${project.id}/assets/`)
    await expect(dispatchWebRpc('nomi:assets:import-remote-url', [{ ...payload, projectId: 'foreign' }], surface)).rejects.toThrow('another project')
    await expect(dispatchWebRpc('nomi:assets:import-remote-url', [{ ...payload, url: 'http://127.0.0.1:8188/view' }], surface)).rejects.toThrow('owned or inline')
  })
})
