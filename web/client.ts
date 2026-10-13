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
const appliedAgentNodes = new Map<string, Set<string>>()
function rememberAgentNodes(projectId: string, ids: string[]) {
  const applied = appliedAgentNodes.get(projectId) || new Set<string>()
  ids.forEach(id => applied.add(id)); appliedAgentNodes.set(projectId, applied)
}

function requestBody(channel: string, args: unknown[]) {
  return JSON.stringify({ channel, args: translateMediaValues(args, 'server', location.origin) })
}
function readResponse(raw: { ok: boolean; value?: unknown; error?: string }) {
  if (!raw.ok) throw new Error(raw.error || 'Nomi Web request failed')
  return translateMediaValues(raw.value, 'browser', location.origin)
}
async function invoke(channel: string, ...args: unknown[]) {
  if (channel === 'nomi:projects:save-async') args.push([...(args[1] as { payload?: { webAgentSeenNodeIds?: string[] } }).payload?.webAgentSeenNodeIds || []])
  const response = await fetch('/api/rpc', { method: 'POST', headers, body: requestBody(channel, args) })
  const value = readResponse(await response.json())
  if (channel === 'nomi:projects:read-async' || channel === 'nomi:projects:read') {
    const record = value as { id?: string; payload?: { generationCanvas?: { nodes?: { id: string; meta?: { isWebAgentCreated?: boolean } }[] } } } | null
    if (record?.id) rememberAgentNodes(record.id, (record.payload?.generationCanvas?.nodes || []).filter(node => node.meta?.isWebAgentCreated).map(node => node.id))
  }
  return value
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
    bridge.web = {
      generationSnapshot: projectId => invoke('nomi:web:generation-snapshot', projectId) as ReturnType<NonNullable<DesktopBridge['web']>['generationSnapshot']>,
      acknowledgeAgentNodes: async (projectId, ids) => { rememberAgentNodes(projectId, ids) },
      appliedAgentNodeIds: projectId => [...(appliedAgentNodes.get(projectId) || [])],
      agentSettings: selection => invoke('nomi:web:agent-settings', selection) as ReturnType<NonNullable<DesktopBridge['web']>['agentSettings']>,
      agentModels: engine => invoke('nomi:web:agent-models', engine) as ReturnType<NonNullable<DesktopBridge['web']>['agentModels']>,
    }
    delete bridge.browser
    delete bridge.capability
    if (bridge.onboarding) delete bridge.onboarding.integrationHandoffSubscribe
    delete bridge.feedback
    delete bridge.telemetry
    delete bridge.log
    if (bridge.tasks) { delete bridge.tasks.comfyuiWatch; delete bridge.tasks.comfyuiUnwatch }
    // 2026-10-13 실측: 웹 서버에는 production-run 유료 확인 표면이 없다(`web/rpc.ts` 의
    // `dispatchWebRpc` 가 `nomi:production-runs:pending-spend` 를 구현하지 않는다 — 웹은
    // 캔버스 경로의 `nomi:tasks:quote-spend`/`grant-spend` 만 갖는다). 그런데 데스크톱 preload 의
    // `productionRuns` 는 통째로 넘어와, 에이전트 패널이 주기적으로 그 채널을 부르고 실패해
    // 「확인 카드가 여기 있어야 해요 / host-unreachable」 폴백을 **상시** 띄웠다(실제 콘솔 로그:
    // `[nomi:missing-intervention-card] {announcer: "spend-confirm", reason: "host-unreachable"}`).
    // 없는 표면은 노출하지 않는다 — `hasPendingSpendCapability()` 가 false 가 되어 카드가 안 뜨고,
    // 대신 웹에 실제로 있는 캔버스 유료 확인(SpendConfirmDialog)이 그대로 동작한다.
    if (bridge.productionRuns) {
      for (const member of ['pendingSpend', 'reviseSpend', 'discardSpend', 'confirmSpend', 'removeSpendShot', 'confirmSpendRemaining'] as const) {
        delete (bridge.productionRuns as Partial<typeof bridge.productionRuns>)[member]
      }
    }
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
