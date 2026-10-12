/** Dedicated Chromium runtime owned by Nomi Web, with Chromium's sandbox retained.
 *
 * The browser root comes from the caller, so nothing is tied to one machine. Linux
 * only, because the sandbox is kept with a dedicated AppArmor userns profile instead
 * of changing any global sysctl.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const profilePath = '/etc/apparmor.d/nomi-web-chromium'
const marker = '# Managed by nomi-web: dedicated graph conversion browser'
export function installWebBrowser({ release, browserRoot }) {
  if (process.platform !== 'linux') throw new Error('Sandboxed Chromium install requires Linux (dedicated AppArmor userns profile)')
  fs.mkdirSync(browserRoot, { recursive: true, mode: 0o700 })
  if (fs.realpathSync(browserRoot) !== browserRoot) throw new Error('Web browser directory must be independent; existing symlink preserved')
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserRoot, PLAYWRIGHT_SKIP_BROWSER_GC: '1' }
  execFileSync('corepack', ['pnpm', 'exec', 'playwright', 'install', 'chromium'], { cwd: release, env, stdio: 'inherit' })
  const restriction = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns'
  if (fs.existsSync(restriction) && fs.readFileSync(restriction, 'utf8').trim() === '1') {
    if (fs.existsSync(profilePath) && !fs.readFileSync(profilePath, 'utf8').startsWith(marker)) throw new Error('Existing unrelated AppArmor profile preserved')
    const profile = `${marker}\nprofile nomi-web-chromium ${browserRoot}/chromium-*/chrome-linux64/chrome flags=(unconfined) {\n  userns,\n}\nprofile nomi-web-headless ${browserRoot}/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell flags=(unconfined) {\n  userns,\n}\n`
    const temporary = path.join(browserRoot, 'nomi-web-chromium.profile')
    fs.writeFileSync(temporary, profile, { mode: 0o600 })
    try {
      execFileSync('sudo', ['-n', 'install', '-m', '0644', temporary, profilePath], { stdio: 'inherit' })
      execFileSync('sudo', ['-n', 'apparmor_parser', '-r', profilePath], { stdio: 'inherit' })
    } finally { fs.unlinkSync(temporary) }
  }
  // Match the service's NoNewPrivileges setting before activating the release.
  execFileSync('setpriv', ['--no-new-privs', process.execPath, '--input-type=module', '--eval',
    "import { chromium } from 'playwright'; const browser = await chromium.launch({ headless: true, chromiumSandbox: true }); console.log('Nomi Web sandboxed Chromium:', browser.version()); await browser.close();"], { cwd: release, env, stdio: 'inherit' })
  return browserRoot
}
