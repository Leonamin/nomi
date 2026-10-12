import fs from 'node:fs'
import { classifyValidationPolicy, VALIDATION_POLICY_OUTPUTS } from './validation-policy.mjs'
import { gitNameStatus } from './lib/gitPaths.mjs'

function changedEntries({ cwd = process.cwd(), base, head } = {}) {
  if (!base || !head) return []
  // 路径一律经 gitNameStatus 读（`-z`）：默认 quotePath 会把非 ASCII 路径转义并加引号，
  // 分类器于是把 `docs/中文.md` 当成不认识的路径，整条 PR 的验证档被选错。
  return gitNameStatus(['diff', '--name-status', base, head], { cwd })
}

/**
 * 手动单面复跑的白名单（2026-10-12）。每个只开自己那一格，其余面照旧 skipped：
 * 这不是放宽判据，而是把人工恢复的代价从「整张矩阵」降到「一格」。
 * PR / push / merge_group 永远走 classifyValidationPolicy，进不到这里。
 */
const MANUAL_SURFACE_PROFILES = Object.freeze({
  contracts: { unit: 'none', coreSmoke: false, desktop: false, journeys: false, canvas: 'none', performance: false, package: false },
  unit: { unit: 'full', coreSmoke: false, desktop: false, journeys: false, canvas: 'none', performance: false, package: false },
  'core-smoke': { unit: 'none', coreSmoke: true, desktop: false, journeys: false, canvas: 'none', performance: false, package: false },
  e2e: { unit: 'none', coreSmoke: false, desktop: true, journeys: true, canvas: 'none', performance: false, package: false },
  'canvas-acceptance': { unit: 'none', coreSmoke: false, desktop: false, journeys: false, canvas: 'full', performance: false, package: false },
  'canvas-performance': { unit: 'none', coreSmoke: false, desktop: false, journeys: false, canvas: 'none', performance: true, package: false },
  'mac-package': { unit: 'none', coreSmoke: false, desktop: false, journeys: false, canvas: 'none', performance: false, package: true },
})

export const MANUAL_SURFACES = Object.freeze(Object.keys(MANUAL_SURFACE_PROFILES))

function manualSurfaceProfile(name, files) {
  const profile = MANUAL_SURFACE_PROFILES[name]
  if (!profile) return null
  const reason = `manual_surface:${name}`
  return { ...profile, release: false, failClosed: false, reason, reasons: [reason], files }
}

export function resolveProfileFromEnvironment(env = process.env, cwd = process.cwd()) {
  const eventName = env.GITHUB_EVENT_NAME || 'pull_request'
  const requestedMode = env.NOMI_VALIDATION_MODE || ''
  const entries = changedEntries({ cwd, base: env.NOMI_BASE_SHA, head: env.NOMI_HEAD_SHA || 'HEAD' })
  // 手动单面复跑（2026-10-12，workflow_dispatch 的 surfaces 输入）：把「整张矩阵」换成「恰好那一格」。
  // 只认在白名单里的名字；给了不认识的 surface 就 fail-closed 到全量，绝不静默跑半套还报绿。
  const onlySurface = String(env.NOMI_ONLY_SURFACE || '').trim()
  if (onlySurface && onlySurface !== 'all') {
    const manual = manualSurfaceProfile(onlySurface, entries)
    if (manual) return { ...manual, onlySurface }
    const full = classifyValidationPolicy(entries, { requestedMode: 'full' })
    return { ...full, reason: `unknown_manual_surface:${onlySurface}`, onlySurface: '' }
  }
  return classifyValidationPolicy(entries, { eventName, requestedMode })
}

export function writeGithubOutput(result, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return
  const values = VALIDATION_POLICY_OUTPUTS.map((name) => {
    const outputName = name.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`)
    return `${outputName}=${result[name]}`
  })
  fs.appendFileSync(
    outputPath,
    `${[...values, `reason=${result.reason}`, `changed_count=${result.files.length}`, `only_surface=${result.onlySurface ?? ''}`].join('\n')}\n`,
  )
}

if (process.argv[1] && process.argv[1].endsWith('select-quality-gate-profile.mjs')) {
  try {
    const result = resolveProfileFromEnvironment()
    writeGithubOutput(result)
    console.log(
      `quality-gate policy: unit=${result.unit}, desktop=${result.desktop}, journeys=${result.journeys}, canvas=${result.canvas}, performance=${result.performance}, package=${result.package} (${result.reason}; ${result.files.length} changed files)`,
    )
  } catch (error) {
    const result = classifyValidationPolicy([], { requestedMode: 'full' })
    result.reason = 'classifier_error_fail_closed'
    writeGithubOutput(result)
    console.error(error instanceof Error ? error.message : String(error))
    console.error(`quality-gate policy: all surfaces (${result.reason})`)
    process.exit(0)
  }
}
