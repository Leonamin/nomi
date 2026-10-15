import type { DesktopBridge } from '../src/desktop/bridge'

/** Native preload methods without an admitted Web RPC route or browser adapter. */
export const unsupportedWebHostMethods: ReadonlyArray<{ path: readonly string[]; channel?: string }> = [
  { path: ['skill'], channel: 'nomi:skill:list' },
  { path: ['screenshot'], channel: 'nomi:screenshot:get' },
  { path: ['memory'], channel: 'nomi:memory:get' },
  { path: ['assetTransport'], channel: 'nomi:asset-transport:describe-channels' },
  { path: ['clipboard', 'readFilePaths'], channel: 'nomi:clipboard:read-file-paths' },
  { path: ['clipboard', 'getPathForFile'] },
  { path: ['videoDepth'], channel: 'nomi:video-depth:prepare' },
  { path: ['video', 'deconstruct'], channel: 'nomi:video:deconstruct' },
  { path: ['video', 'detectShotCuts'], channel: 'nomi:video:detect-shot-cuts' },
  { path: ['workspace', 'selectFolder'], channel: 'nomi:workspace:select-folder' },
  { path: ['workspace', 'openFolder'], channel: 'nomi:workspace:open-folder' },
  { path: ['workspace', 'listFiles'], channel: 'nomi:workspace:list-files' },
  { path: ['workspace', 'deleteFiles'], channel: 'nomi:workspace:delete-files' },
  { path: ['workspace', 'revealFile'], channel: 'nomi:workspace:reveal-file' },
  { path: ['workspace', 'revealProjectFolder'], channel: 'nomi:workspace:reveal-project-folder' },
  { path: ['workspace', 'syncReveal'], channel: 'nomi:workspace:sync-reveal' },
  { path: ['workspace', 'syncCopyConflict'], channel: 'nomi:workspace:sync-copy-conflict' },
  { path: ['assets', 'copyFiles'], channel: 'nomi:assets:copy-files' },
  { path: ['assets', 'importFile'], channel: 'nomi:assets:import-file' },
  { path: ['assets', 'storageCapacity'], channel: 'nomi:assets:storage-capacity' },
  { path: ['assets', 'seedOnboardingDemo'], channel: 'nomi:assets:seed-onboarding-demo' },
  { path: ['settings', 'automationPolicy', 'set'], channel: 'nomi:settings:automation-policy-set' },
  { path: ['settings', 'projectLocation', 'pick'], channel: 'nomi:settings:project-location-pick' },
  { path: ['settings', 'projectLocation', 'reset'], channel: 'nomi:settings:project-location-reset' },
  { path: ['settings', 'projectLocation', 'reveal'], channel: 'nomi:settings:project-location-reveal' },
  { path: ['settings', 'attentionSound', 'pick'], channel: 'nomi:settings:attention-sound-pick' },
  { path: ['settings', 'attentionSound', 'preview'], channel: 'nomi:settings:attention-sound-preview' },
  { path: ['settings', 'attentionSound', 'reset'], channel: 'nomi:settings:attention-sound-reset' },
  { path: ['settings', 'attentionSound', 'stop'], channel: 'nomi:settings:attention-sound-stop' },
  { path: ['settings', 'assetRelay'], channel: 'nomi:settings:asset-relay-get' },
  { path: ['settings', 'telemetry'], channel: 'nomi:settings:telemetry-get' },
  { path: ['settings', 'diagnostics'], channel: 'nomi:settings:diagnostics-open-trace-directory' },
  { path: ['connector', 'tikhub'], channel: 'nomi:connector:tikhub:key-status' },
  { path: ['director', 'mobile'], channel: 'nomi:director:mobile:status' },
]

export function projectWebHostCapabilities(bridge: DesktopBridge): DesktopBridge {
  for (const { path } of unsupportedWebHostMethods) {
    let parent: Record<string, unknown> | undefined = bridge as unknown as Record<string, unknown>
    for (const segment of path.slice(0, -1)) {
      const next: unknown = parent?.[segment]
      parent = next && typeof next === 'object' ? next as Record<string, unknown> : undefined
    }
    if (parent) Reflect.deleteProperty(parent, path[path.length - 1])
  }
  return bridge
}
