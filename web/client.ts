import type { DesktopBridge } from '../src/desktop/bridge'
import { translateMediaValues } from './mediaUrls'

type Listener = (_event: unknown, payload: unknown) => void
const listeners = new Map<string, Set<Listener>>()
const clientId = crypto.randomUUID()
const tokenRequest = new XMLHttpRequest()
tokenRequest.open('GET', '/api/session', false)
tokenRequest.send()
if (tokenRequest.status !== 200) throw new Error('Nomi Web server is unavailable')
const { token } = JSON.parse(tokenRequest.responseText) as { token: string }
const headers = { 'content-type': 'application/json', 'x-nomi-token': token, 'x-nomi-client': clientId }

function requestBody(channel: string, args: unknown[]) {
  return JSON.stringify({ channel, args: translateMediaValues(args, 'server', location.origin) })
}
function readResponse(raw: { ok: boolean; value?: unknown; error?: string }) {
  if (!raw.ok) throw new Error(raw.error || 'Nomi Web request failed')
  return translateMediaValues(raw.value, 'browser', location.origin)
}
async function invoke(channel: string, ...args: unknown[]) {
  const response = await fetch('/api/rpc', { method: 'POST', headers, body: requestBody(channel, args) })
  return readResponse(await response.json())
}
export const ipcRenderer = {
  invoke,
  sendSync(channel: string, ...args: unknown[]) {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/rpc', false)
    Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value))
    request.send(requestBody(channel, args))
    const raw = JSON.parse(request.responseText)
    return raw.ok ? { ok: true, value: translateMediaValues(raw.value, 'browser', location.origin) } : raw
  },
  send(channel: string, ...args: unknown[]) { void invoke(channel, ...args).catch(error => console.error('Nomi Web:', channel, error)) },
  on(channel: string, listener: Listener) {
    const callbacks = listeners.get(channel) ?? new Set()
    callbacks.add(listener); listeners.set(channel, callbacks)
  },
  removeListener(channel: string, listener: Listener) { listeners.get(channel)?.delete(listener) },
}
let surfaceId: string | undefined
const events = new EventSource(`/api/events?clientId=${encodeURIComponent(clientId)}`)
events.onmessage = event => {
  const { channel, payload } = JSON.parse(event.data)
  if (channel === 'nomi:web:session') {
    if (payload.token !== token || (surfaceId && surfaceId !== payload.surfaceId)) location.reload()
    surfaceId = payload.surfaceId
    return
  }
  for (const callback of listeners.get(channel) ?? []) callback(null, translateMediaValues(payload, 'browser', location.origin))
}
export const webUtils = { getPathForFile: () => '' }
export const contextBridge = {
  exposeInMainWorld(name: string, bridge: DesktopBridge) {
    bridge.platform = 'web'
    bridge.web = { generationSnapshot: projectId => invoke('nomi:web:generation-snapshot', projectId) as ReturnType<NonNullable<DesktopBridge['web']>['generationSnapshot']> }
    delete bridge.agentLane
    delete bridge.browser
    delete bridge.capability
    if (bridge.onboarding) delete bridge.onboarding.integrationHandoffSubscribe
    delete bridge.feedback
    delete bridge.telemetry
    delete bridge.log
    if (bridge.tasks) { delete bridge.tasks.comfyuiWatch; delete bridge.tasks.comfyuiUnwatch }
    if (bridge.i18n) bridge.i18n.getSystemLocale = () => navigator.language
    if (bridge.app) bridge.app.hardReloadWindow = () => location.reload()
    bridge.assets.importNativeFile = async (file: File, payload: Record<string, unknown>) => {
      const form = new FormData()
      form.set('file', file); form.set('payload', JSON.stringify(payload))
      const response = await fetch('/api/upload', { method: 'POST', headers: { 'x-nomi-token': token, 'x-nomi-client': clientId }, body: form })
      return readResponse(await response.json()) as Awaited<ReturnType<NonNullable<DesktopBridge['assets']['importNativeFile']>>>
    }
    const download = (url: string) => {
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = ''; anchor.click()
    }
    bridge.exports.showInFolder = async (payload: { projectId: string; relativePath: string }) => {
      download(`/api/download/${encodeURIComponent(payload.projectId)}/${payload.relativePath.split('/').map(encodeURIComponent).join('/')}`)
      return { ok: true }
    }
    bridge.assets.download = async (payload: { url?: string }) => {
      const url = new URL(payload.url || '', location.origin)
      if (url.origin !== location.origin || !url.pathname.startsWith('/api/media/')) throw new Error('Only project media can be downloaded')
      download(url.href); return { ok: true }
    }
    Object.defineProperty(window, name, { value: bridge })
    Object.defineProperty(window, 'nomiWeb', { value: true })
  },
}
