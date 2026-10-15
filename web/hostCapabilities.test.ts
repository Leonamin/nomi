import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { projectWebHostCapabilities, unsupportedWebHostMethods } from './hostCapabilities'

function desktopShape() {
  const method = vi.fn()
  return {
    platform: 'electron',
    skill: { list: method, importPackage: method },
    screenshot: { get: method, set: method },
    memory: { get: method },
    assetTransport: { describeChannels: method },
    clipboard: { readFilePaths: method, getPathForFile: method },
    videoDepth: { prepare: method },
    video: { extractFrame: method, extractFilmstrip: method, deconstruct: method, detectShotCuts: method },
    workspace: { listFiles: method, deleteFiles: method, syncInspect: method },
    assets: { list: method, importNativeFile: method, copyFiles: method, ensurePreview: method },
    settings: {
      automationPolicy: { get: method, set: method },
      projectLocation: { get: method, check: method, pick: method, reset: method, reveal: method },
      attentionSound: { get: method, set: method, pick: method, preview: method, reset: method, stop: method },
      assetRelay: { get: method, set: method }, telemetry: { get: method }, diagnostics: { openTraceDirectory: method },
    },
    connector: { tikhub: { keyStatus: method } },
    director: { mobile: { status: method } },
  }
}

describe('Web host capability projection', () => {
  it('removes unsupported native methods before renderer guards inspect the bridge', () => {
    const bridge = projectWebHostCapabilities(desktopShape() as never) as unknown as ReturnType<typeof desktopShape>
    expect(bridge.skill).toBeUndefined()
    expect(bridge.screenshot).toBeUndefined()
    expect(bridge.memory).toBeUndefined()
    expect(bridge.assetTransport).toBeUndefined()
    expect(bridge.clipboard.readFilePaths).toBeUndefined()
    expect(bridge.videoDepth).toBeUndefined()
    expect(bridge.video.deconstruct).toBeUndefined()
    expect(bridge.video.detectShotCuts).toBeUndefined()
    expect(bridge.workspace.listFiles).toBeUndefined()
    expect(bridge.workspace.deleteFiles).toBeUndefined()
    expect(bridge.settings.automationPolicy.set).toBeUndefined()
    expect(bridge.settings.projectLocation.pick).toBeUndefined()
    expect(bridge.settings.attentionSound.preview).toBeUndefined()
    expect(bridge.settings.assetRelay).toBeUndefined()
    expect(bridge.settings.telemetry).toBeUndefined()
    expect(bridge.settings.diagnostics).toBeUndefined()
    expect(bridge.connector.tikhub).toBeUndefined()
    expect(bridge.director.mobile).toBeUndefined()
  })

  it('keeps admitted Web RPC methods and the browser upload adapter', () => {
    const bridge = projectWebHostCapabilities(desktopShape() as never) as unknown as ReturnType<typeof desktopShape>
    expect(bridge.assets.list).toBeTypeOf('function')
    expect(bridge.assets.importNativeFile).toBeTypeOf('function')
    expect(bridge.video.extractFrame).toBeTypeOf('function')
    expect(bridge.video.extractFilmstrip).toBeTypeOf('function')
    expect(bridge.settings.automationPolicy.get).toBeTypeOf('function')
    expect(bridge.settings.attentionSound.set).toBeTypeOf('function')
    expect(bridge.settings.projectLocation.check).toBeTypeOf('function')
    expect(bridge.workspace.syncInspect).toBeTypeOf('function')
  })

  it('keeps the unsupported-method inventory disjoint from the actual Web RPC command table', () => {
    const rpc = readFileSync(fileURLToPath(new URL('./rpc.ts', import.meta.url)), 'utf8')
    for (const entry of unsupportedWebHostMethods) {
      if (entry.channel) expect(rpc).not.toContain(`'${entry.channel}':`)
    }
  })
})
