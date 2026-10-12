/** Linux-only browser runtime owned by Nomi Web, with Chromium's sandbox retained. */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = '/home/leonamin/nomi-web-data/browser'
const profilePath = '/etc/apparmor.d/nomi-web-chromium'
const marker = '# Managed by nomi-web: dedicated graph conversion browser'
export function installWebBrowser(release) {
  if (process.platform !== 'linux') throw new Error('This deployment targets hamsbox Linux')
  fs.mkdirSync(root, { recursive: true, mode: 0o700 })
  if (fs.realpathSync(root) !== root) throw new Error('Web browser directory must be independent; existing symlink preserved')
  execFileSync('corepack', ['pnpm', 'exec', 'playwright', 'install', 'chromium'], { cwd: release, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: root }, stdio: 'inherit' })
  const restriction = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns'
  if (fs.existsSync(restriction) && fs.readFileSync(restriction, 'utf8').trim() === '1') {
    if (fs.existsSync(profilePath) && !fs.readFileSync(profilePath, 'utf8').startsWith(marker)) throw new Error('Existing unrelated AppArmor profile preserved')
    const profile = `${marker}\nprofile nomi-web-chromium ${root}/chromium-*/chrome-linux64/chrome flags=(unconfined) {\n  userns,\n}\nprofile nomi-web-headless ${root}/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell flags=(unconfined) {\n  userns,\n}\n`
    const temporary = path.join(root, 'nomi-web-chromium.profile')
    fs.writeFileSync(temporary, profile, { mode: 0o600 })
    try {
      execFileSync('sudo', ['-n', 'install', '-m', '0644', temporary, profilePath], { stdio: 'inherit' })
      execFileSync('sudo', ['-n', 'apparmor_parser', '-r', profilePath], { stdio: 'inherit' })
    } finally { fs.unlinkSync(temporary) }
  }
  return root
}
