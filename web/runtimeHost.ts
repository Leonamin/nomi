/** Node host for Nomi's existing domain modules. No Electron process is launched. */
import { EventEmitter } from 'node:events'
import path from 'node:path'
import fs from 'node:fs'

export const hostEvents = new EventEmitter()
const root = process.env.NOMI_WEB_DATA_DIR
if (!root || !path.isAbsolute(root)) throw new Error('NOMI_WEB_DATA_DIR must be an absolute, dedicated directory')
fs.mkdirSync(root, { recursive: true, mode: 0o700 })
if (fs.realpathSync(root) !== path.resolve(root) || /(?:^|\/)nomi-data(?:\/|$)/.test(root)) throw new Error('The web data root must be independent and cannot be a symlink or the desktop data directory')
for (const [key, leaf] of [['NOMI_SETTINGS_DIR', 'profile'], ['NOMI_PROJECTS_DIR', 'projects']] as const) {
  const expected = path.join(root, leaf)
  if (process.env[key] && process.env[key] !== expected) throw new Error(`${key} must be inside the web data directory`)
  fs.mkdirSync(expected, { recursive: true, mode: 0o700 })
  if (fs.realpathSync(expected) !== expected) throw new Error('Web data directories cannot be symlinks')
  process.env[key] = expected
}

export const app = Object.assign(new EventEmitter(), {
  isPackaged: false,
  getName: () => 'Nomi Web',
  getVersion: () => '0.23.1',
  getAppPath: () => process.cwd(),
  getLocale: () => 'en',
  getPath: (name: string) => {
    if (name === 'userData') return path.join(root, 'profile')
    if (name === 'logs') return path.join(root, 'logs')
    if (name === 'temp') return path.join(root, 'temp')
    if (name === 'documents') return path.join(root, 'projects')
    throw new Error(`Desktop path is unavailable in the web host: ${name}`)
  },
})
function unavailable(): never { throw new Error('This desktop capability is unavailable in Nomi Web') }
export const safeStorage = { isEncryptionAvailable: () => false, encryptString: unavailable, decryptString: unavailable }
export const ipcMain = Object.assign(new EventEmitter(), { handle: (_channel: string, _handler: unknown) => unavailable() })
const domainHostContents = Object.assign(new EventEmitter(), {
  id: 0, isDestroyed: () => false,
  send: (channel: string, payload: unknown) => hostEvents.emit('message', { channel, payload }),
})
const broadcastWindow = { isDestroyed: () => false, webContents: domainHostContents }
export const BrowserWindow = { getAllWindows: () => [broadcastWindow], fromWebContents: unavailable }
export const webContents = { getAllWebContents: () => [domainHostContents], fromId: (id: number) => id === 0 ? domainHostContents : undefined }
export const shell = { showItemInFolder: unavailable, openPath: unavailable, openExternal: unavailable }
export const dialog = { showOpenDialog: unavailable, showSaveDialog: unavailable }
export const session = { defaultSession: undefined }
export const nativeImage = { createFromBuffer: unavailable }
export const protocol = { handle: unavailable }
