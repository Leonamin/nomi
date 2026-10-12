/** Run on hamsbox from a fetched, clean release. Sources only arrive through Git. */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const sha = process.argv[2]
const base = '/home/leonamin/apps/nomi-web'
const data = '/home/leonamin/nomi-web-data'
const origin = 'https://hamsbox.badger-viper.ts.net:8445'
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Pass an exact fetched commit SHA')
const run = (command, args, cwd, shouldCaptureOutput = false) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: shouldCaptureOutput ? 'pipe' : 'inherit' })
const release = path.join(base, 'releases', sha)
const current = path.join(base, 'current')
const assertClean = dir => {
  const state = run('git', ['status', '--porcelain', '--untracked-files=all'], dir, true)
  if (state.trim()) throw new Error(`Dirty checkout is preserved; refusing deployment: ${dir}`)
}
if (fs.existsSync(current)) {
  if (!fs.lstatSync(current).isSymbolicLink()) throw new Error('current must be a symlink; existing directory preserved')
  assertClean(fs.realpathSync(current))
}
assertClean(release)
if (run('git', ['rev-parse', 'HEAD'], release, true).trim() !== sha) throw new Error('Release SHA mismatch')
for (const port of [9031, 19188]) {
  const output = run('ss', ['-ltnH', `sport = :${port}`], release, true)
  if (output.trim()) {
    const unit = port === 9031 ? 'nomi-web.service' : 'nomi-web-comfyui.service'
    try { run('systemctl', ['--user', 'is-active', '--quiet', unit], release, true) } catch { throw new Error(`Port ${port} is occupied by another service`) }
  }
}
fs.mkdirSync(data, { recursive: true, mode: 0o700 })
if (fs.realpathSync(data) !== data || fs.realpathSync(data) === fs.realpathSync('/home/leonamin/nomi-data')) throw new Error('Web data root is not independent')
run('corepack', ['pnpm', 'install', '--frozen-lockfile'], release)
run('corepack', ['pnpm', 'run', 'build:web'], release)
assertClean(release)
const unitRoot = '/home/leonamin/.config/systemd/user'
fs.mkdirSync(unitRoot, { recursive: true })
const units = {
  'nomi-web-comfyui.service': `# Managed by nomi-web\n[Unit]\nDescription=Nomi Web independent leo ComfyUI tunnel\nAfter=network-online.target\n\n[Service]\nExecStart=/usr/bin/ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:19188:127.0.0.1:8188 leo\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`,
  'nomi-web.service': `# Managed by nomi-web\n[Unit]\nDescription=Nomi personal web workspace\nAfter=network-online.target nomi-web-comfyui.service\nWants=nomi-web-comfyui.service\n\n[Service]\nWorkingDirectory=${current}\nEnvironmentFile=${data}/runtime.env\nExecStart=/usr/bin/node dist/web/server.cjs\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=30\nNoNewPrivileges=true\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`,
}
for (const [name, body] of Object.entries(units)) {
  const target = path.join(unitRoot, name)
  if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes('# Managed by nomi-web')) throw new Error(`Existing unrelated unit preserved: ${name}`)
  fs.writeFileSync(target, body, { mode: 0o600 })
}
fs.writeFileSync(path.join(data, 'runtime.env'), `NOMI_WEB_DATA_DIR=${data}\nNOMI_WEB_PORT=9031\nNOMI_WEB_ORIGIN=${origin}\nNOMI_BUILD_SHA=${sha}\n`, { mode: 0o600 })
const next = path.join(base, 'current.next')
if (fs.existsSync(next)) throw new Error('Pending release symlink exists; refusing overwrite')
fs.symlinkSync(release, next)
fs.renameSync(next, current)
run('systemctl', ['--user', 'daemon-reload'], release)
run('systemctl', ['--user', 'enable', '--now', 'nomi-web-comfyui.service'], release)
run('systemctl', ['--user', 'enable', 'nomi-web.service'], release)
run('systemctl', ['--user', 'restart', 'nomi-web.service'], release)
console.log(JSON.stringify({ event: 'web-deployed', sha, release, data, origin }))
