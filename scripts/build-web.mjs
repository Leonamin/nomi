import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const repoRoot = path.resolve(import.meta.dirname, '..')
const buildRoot = path.join(repoRoot, 'dist/web')
fs.mkdirSync(buildRoot, { recursive: true })
// Canonical skill discovery/formatting lives in Nomi's compiled ESM island.
const nativeBuild = spawnSync(process.execPath, ['scripts/build-electron.mjs'], { cwd: repoRoot, stdio: 'inherit' })
if (nativeBuild.status !== 0) process.exit(nativeBuild.status ?? 1)
await build({ entryPoints: [path.join(repoRoot, 'electron/preload.ts')], bundle: true, platform: 'browser', format: 'iife', outfile: path.join(repoRoot, 'public/web-bridge.js'), alias: { electron: path.join(repoRoot, 'web/client.ts') }, define: { 'process.platform': '"web"', 'process.env': '{}' }, target: 'es2022' })
for (const args of [['scripts/build-tailwind.mjs', '--minify'], ['node_modules/vite/bin/vite.js', 'build', '--mode', 'production', '--outDir', 'dist/web/client']]) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
const indexPath = path.join(buildRoot, 'client/index.html')
fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace('<head>', '<head><script src="/web-bridge.js"></script>'))
await build({ entryPoints: [path.join(repoRoot, 'web/server.ts')], bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: path.join(buildRoot, 'server.cjs'), alias: { electron: path.join(repoRoot, 'web/runtimeHost.ts') }, target: 'node24', sourcemap: true, loader: { '.woff2': 'empty', '.css': 'empty' } })
