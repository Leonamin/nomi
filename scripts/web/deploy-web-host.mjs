/** Deploy the Nomi web workspace on a web host from a fetched, clean Git release.
 *
 * Run on the host after `git fetch` + a clean release checkout. Sources arrive only
 * through Git. Every value below comes from the environment; defaults derive from
 * `$HOME` so nothing is tied to one machine.
 *
 *   NOMI_WEB_RELEASE_DIR       release root              (default: $HOME/apps/nomi-web)
 *   NOMI_WEB_DATA_DIR          dedicated web data root    (default: $HOME/nomi-web-data)
 *   NOMI_WEB_LEGACY_DATA_DIR   root that must stay separate (default: $HOME/nomi-data)
 *   NOMI_WEB_ORIGIN            exact Host/Origin boundary (default: http://127.0.0.1:$NOMI_WEB_PORT)
 *   NOMI_WEB_PORT              local web port             (default: 9031)
 *   NOMI_WEB_COMFYUI_SSH       ssh destination for the GPU tunnel, e.g. user@host; empty disables it
 *   NOMI_WEB_COMFYUI_PORT      local tunnel port          (default: 19188)
 *   NOMI_WEB_COMFYUI_TARGET_PORT remote ComfyUI port       (default: 8188)
 *   NOMI_WEB_SOURCE_REPO       public source link base for /source
 *   NOMI_WEB_NODE_BIN          node binary for the unit    (default: the running node)
 *   NOMI_WEB_SSH_BIN           ssh binary for the unit     (default: /usr/bin/ssh)
 *   NOMI_WEB_SYSTEMD_USER_DIR  user unit dir               (default: $HOME/.config/systemd/user)
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const sha = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Pass an exact fetched commit SHA')

const env = process.env
const home = os.homedir()
const base = env.NOMI_WEB_RELEASE_DIR || path.join(home, 'apps', 'nomi-web')
const data = env.NOMI_WEB_DATA_DIR || path.join(home, 'nomi-web-data')
const legacyData = env.NOMI_WEB_LEGACY_DATA_DIR || path.join(home, 'nomi-data')
const webPort = Number(env.NOMI_WEB_PORT || 9031)
const comfyPort = Number(env.NOMI_WEB_COMFYUI_PORT || 19188)
const comfyTargetPort = Number(env.NOMI_WEB_COMFYUI_TARGET_PORT || 8188)
const comfySsh = env.NOMI_WEB_COMFYUI_SSH || ''
const sourceRepo = env.NOMI_WEB_SOURCE_REPO || ''
const nodeBin = env.NOMI_WEB_NODE_BIN || process.execPath
const sshBin = env.NOMI_WEB_SSH_BIN || '/usr/bin/ssh'
const unitRoot = env.NOMI_WEB_SYSTEMD_USER_DIR || path.join(home, '.config', 'systemd', 'user')
const origin = env.NOMI_WEB_ORIGIN || `http://127.0.0.1:${webPort}`

const webUnit = 'nomi-web.service'
const comfyUnit = 'nomi-web-comfyui.service'
const run = (command, args, cwd, shouldCaptureOutput = false) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: shouldCaptureOutput ? 'pipe' : 'inherit' })
const release = path.join(base, 'releases', sha)
const current = path.join(base, 'current')
const assertClean = dir => {
  const state = run('git', ['status', '--porcelain', '--untracked-files=all'], dir, true)
  if (state.trim()) throw new Error(`Dirty checkout is preserved; refusing deployment: ${dir}`)
}
if (!fs.existsSync(release)) throw new Error(`Release checkout is missing; fetch and check out ${sha} first: ${release}`)
if (fs.existsSync(current)) {
  if (!fs.lstatSync(current).isSymbolicLink()) throw new Error('current must be a symlink; existing directory preserved')
  assertClean(fs.realpathSync(current))
}
assertClean(release)
if (run('git', ['rev-parse', 'HEAD'], release, true).trim() !== sha) throw new Error('Release SHA mismatch')
const ports = [{ port: webPort, unit: webUnit }]
if (comfySsh) ports.push({ port: comfyPort, unit: comfyUnit })
for (const { port, unit } of ports) {
  const output = run('ss', ['-ltnH', `sport = :${port}`], release, true)
  if (output.trim()) {
    try { run('systemctl', ['--user', 'is-active', '--quiet', unit], release, true) } catch { throw new Error(`Port ${port} is occupied by another service`) }
  }
}
fs.mkdirSync(data, { recursive: true, mode: 0o700 })
if (fs.realpathSync(data) !== data) throw new Error('Web data root must be a real directory, not a symlink')
if (fs.existsSync(legacyData) && fs.realpathSync(data) === fs.realpathSync(legacyData)) throw new Error('Web data root must stay independent from the legacy data root')
run('corepack', ['pnpm', 'install', '--frozen-lockfile'], release)
run('corepack', ['pnpm', 'run', 'build:web'], release)
assertClean(release)
fs.mkdirSync(unitRoot, { recursive: true })
const units = {
  [webUnit]: `# Managed by nomi-web\n[Unit]\nDescription=Nomi web workspace\nAfter=network-online.target${comfySsh ? ` ${comfyUnit}` : ''}\n${comfySsh ? `Wants=${comfyUnit}\n` : ''}[Service]\nWorkingDirectory=${current}\nEnvironmentFile=${data}/runtime.env\nExecStart=${nodeBin} dist/web/server.cjs\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=30\nNoNewPrivileges=true\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`,
}
if (comfySsh) units[comfyUnit] = `# Managed by nomi-web\n[Unit]\nDescription=Nomi web ComfyUI tunnel\nAfter=network-online.target\n\n[Service]\nExecStart=${sshBin} -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:${comfyPort}:127.0.0.1:${comfyTargetPort} ${comfySsh}\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`
for (const [name, body] of Object.entries(units)) {
  const target = path.join(unitRoot, name)
  if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes('# Managed by nomi-web')) throw new Error(`Existing unrelated unit preserved: ${name}`)
  fs.writeFileSync(target, body, { mode: 0o600 })
}
const runtimeEnv = [`NOMI_WEB_DATA_DIR=${data}`, `NOMI_WEB_PORT=${webPort}`, `NOMI_WEB_ORIGIN=${origin}`, `NOMI_BUILD_SHA=${sha}`]
if (sourceRepo) runtimeEnv.push(`NOMI_WEB_SOURCE_REPO=${sourceRepo}`)
fs.writeFileSync(path.join(data, 'runtime.env'), `${runtimeEnv.join('\n')}\n`, { mode: 0o600 })
const next = path.join(base, 'current.next')
if (fs.existsSync(next)) throw new Error('Pending release symlink exists; refusing overwrite')
fs.symlinkSync(release, next)
fs.renameSync(next, current)
run('systemctl', ['--user', 'daemon-reload'], release)
if (comfySsh) run('systemctl', ['--user', 'enable', '--now', comfyUnit], release)
run('systemctl', ['--user', 'enable', webUnit], release)
run('systemctl', ['--user', 'restart', webUnit], release)
console.log(JSON.stringify({ event: 'web-deployed', sha, release, data, origin }))
