import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  test: { include: ['web/**/*.test.ts'], environment: 'node', setupFiles: ['./web/testSetup.ts'] },
  resolve: { alias: { electron: fileURLToPath(new URL('./web/runtimeHost.ts', import.meta.url)) } },
})
