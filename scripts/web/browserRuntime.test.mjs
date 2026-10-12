import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)

describe('web graph browser platform support', () => {
  for (const platform of ['ubuntu26.04-x64', 'mac15-arm64']) {
    it(`resolves a supported Chromium download for ${platform}`, () => {
      const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js')
      const result = spawnSync(process.execPath, [cli, 'install', '--dry-run', 'chromium'], {
        encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: platform },
      })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain('Download url:')
      expect(result.stdout).toContain('chrome')
    })
  }
})
