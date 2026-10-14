import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const script = path.join(import.meta.dirname, 'seed-local-comfyui.mjs')
const appVersion = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'electron', 'catalog', 'catalogVersion.json'), 'utf8')).current
const BASE_URL = 'http://127.0.0.1:19188'
const MODEL_KEY = 'comfy-vendor-model'

/** 只造 seed 真正会读的那几项：一个启用中的 auth-none 本地 ComfyUI 供应商 + 模型 + 一条映射。 */
function sourceCatalog(version) {
  return {
    version,
    vendors: [{ key: 'comfyui-local--candidate-fixture', name: 'Local ComfyUI', enabled: true, authType: 'none', baseUrlHint: 'http://localhost:8188' }],
    models: [{ vendorKey: 'comfyui-local--candidate-fixture', modelKey: MODEL_KEY, kind: 'video', enabled: true }],
    mappings: [{ vendorKey: 'comfyui-local--candidate-fixture', modelKey: MODEL_KEY, create: { url: 'http://localhost:8188/prompt' }, query: { url: 'http://localhost:8188/history' } }],
  }
}

function runSeed(version) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-seed-')))
  const source = path.join(root, 'source-catalog.json')
  // 真实路径：源目录是只读的，数据目录另开一个。
  fs.writeFileSync(source, JSON.stringify(sourceCatalog(version)))
  const data = path.join(root, 'data')
  const result = spawnSync(process.execPath, [script, source, data, MODEL_KEY, BASE_URL], { encoding: 'utf8' })
  const target = path.join(data, 'profile', 'model-catalog.json')
  return { result, target }
}

describe('web local ComfyUI seeding owns the catalog version', () => {
  it('refuses a source catalog newer than this app instead of writing an uneditable file', () => {
    const { result, target } = runSeed(appVersion + 1)
    expect(result.status, result.stderr).not.toBe(0)
    expect(result.stderr).toContain('is newer than this app')
    expect(fs.existsSync(target)).toBe(false)
  })

  it('writes this app\'s own catalog version, not the source file\'s', () => {
    const { result, target } = runSeed(appVersion)
    expect(result.status, result.stderr).toBe(0)
    const written = JSON.parse(fs.readFileSync(target, 'utf8'))
    expect(written.version).toBe(appVersion)
    expect(written.vendors).toHaveLength(1)
    expect(written.vendors[0].baseUrlHint).toBe(BASE_URL)
  })
})
