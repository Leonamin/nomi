import path from 'node:path'
import * as projects from '../electron/projects/repository'
import * as catalog from '../electron/catalog/catalogStore'
import * as exportJobs from '../electron/export/exportJobs'
import { isComfyuiVendor } from '../electron/catalog/types'
import { setDesktopLocale } from '../electron/desktopLocale'
import { listProjectAssets, writeAsset, copyProjectAsset, importRemoteAsset } from '../electron/assets/projectAssetStore'
import { getAssetFolders, saveAssetFolders } from '../electron/assets/assetFolders'
import { ensurePlayableAsset, ensureLocalAssetPreview } from '../electron/assets/localFileImport'
import { extractVideoFrameToAsset, extractVideoFilmstripToAsset } from '../electron/video/extractVideoFrame'
import { readGenerationModelDefaults, writeGenerationModelDefaults } from '../electron/settings/generationModelDefaultsSettings'
import { readVendorPreferenceSettings, writeVendorPreferenceSettings } from '../electron/settings/vendorPreferenceSettings'
import { readModelBoxPreferenceSettings, writeModelBoxPreferenceSettings } from '../electron/settings/modelBoxPreferenceSettings'
import { readCanvasMenuPreferenceSettings, writeCanvasMenuPreferenceSettings } from '../electron/settings/canvasMenuPreferenceSettings'
import { readAttentionSoundSettings, writeAttentionSoundSettings } from '../electron/settings/attentionSoundSettings'
import { readAutomationPolicySettings } from '../electron/settings/automationPolicySettings'
import { readSystemPromptOverrides } from '../electron/settings/systemPromptsSettings'
import { appendEvents, readEvents } from '../electron/events/eventLogRepository'
import { deriveGenerationEtaStats } from '../electron/events/generationEtaStats'
import { listUserPrompts, addUserPrompt, updateUserPrompt, deleteUserPrompt } from '../electron/promptLibrary/userPromptStore'
import { getProjectLocationState } from '../electron/runtimePaths'
import { createWebSurface, WebSurfaceSessions } from './surface'
import { WebGenerationJobs } from './generationJobs'
import { saveWebProject } from './projectState'
import { mintSpendGrant } from '../electron/spendGrant'
import { prepareSpendQuote } from '../electron/spendQuote'
import { getPromptLibrary } from '../electron/promptLibrary/promptLibraryStore'
import { inspectWorkspaceSync } from '../electron/workspace/workspaceSync'
import { setProbedVideoCodecs } from '../electron/assets/videoPlaybackSupport'
import { hostEvents } from './runtimeHost'

type Surface = ReturnType<typeof createWebSurface>
const surfaces = new WebSurfaceSessions()
const exportExecutions = new Map<string, Promise<unknown>>()
export const generationJobs = new WebGenerationJobs(path.join(process.env.NOMI_WEB_DATA_DIR!, 'jobs'))
export function getWebSurface(clientId: string, origin: string) {
  return surfaces.get(clientId, origin)
}
export function acquireWebSurface(clientId: string, origin: string) { return surfaces.acquire(clientId, origin) }
function selection(surface: Surface) {
  const selected = surface.registry.getCommittedProjectSelection()
  if (!selected) throw new Error('Open a project before starting this operation')
  return selected
}
export function authorizeWebProject(surface: Surface, projectId: string) {
  if (selection(surface).projectId !== projectId) throw new Error('Operation belongs to another project')
}
function readonlyProjectsList() { return projects.listProjects() }
function createProject(input: unknown) {
  if (!input || typeof input !== 'object' || 'rootPath' in input) throw new Error('Web projects must use the dedicated data directory')
  return projects.createProject(input)
}
export async function dispatchWebRpc(channel: string, args: unknown[], surface: Surface): Promise<unknown> {
  const commands = {
    'nomi:i18n:get-system-locale': () => 'en',
    'nomi:i18n:set-locale': setDesktopLocale,
    'nomi:app:version': () => ({ version: '0.23.1-web', platform: 'web', arch: process.arch, canAutoInstall: false, canCheckUpdates: false }),
    'nomi:app:confirm-spend-before-close': () => false,
    'nomi:projects:list': readonlyProjectsList,
    'nomi:projects:list-async': readonlyProjectsList,
    'nomi:projects:create': createProject,
    'nomi:projects:read': projects.readProject,
    'nomi:projects:read-async': projects.readProject,
    'nomi:projects:diagnose': projects.diagnoseProject,
    'nomi:projects:recover': projects.recoverProject,
    'nomi:projects:delete': projects.deleteProject,
    'nomi:projects:save-async': saveWebProject,
    'nomi:surface:suspend': surface.suspend,
    'nomi:surface:commitCanvasRead': surface.commit,
    'nomi:surface:release': surface.release,
    'nomi:capability:set-active-project': () => undefined,
    'nomi:model-catalog:vendors:list': () => catalog.listModelCatalogVendors().filter(isComfyuiVendor),
    'nomi:model-catalog:models:list': (params: unknown) => catalog.listModelCatalogModels(params).filter(model => isComfyuiVendor({ key: model.vendorKey })),
    'nomi:model-catalog:mappings:list': catalog.listModelCatalogMappings,
    'nomi:model-catalog:health': catalog.getModelCatalogHealth,
    'nomi:settings:generation-model-defaults-get': readGenerationModelDefaults,
    'nomi:settings:generation-model-defaults-set': writeGenerationModelDefaults,
    'nomi:settings:vendor-preference-get': readVendorPreferenceSettings,
    'nomi:settings:vendor-preference-set': writeVendorPreferenceSettings,
    'nomi:settings:model-box-preference-get': readModelBoxPreferenceSettings,
    'nomi:settings:model-box-preference-set': writeModelBoxPreferenceSettings,
    'nomi:settings:canvas-menu-preference-get': readCanvasMenuPreferenceSettings,
    'nomi:settings:canvas-menu-preference-set': writeCanvasMenuPreferenceSettings,
    'nomi:settings:automation-policy-get': readAutomationPolicySettings,
    'nomi:settings:system-prompts-get': readSystemPromptOverrides,
    'nomi:settings:attention-sound-get': readAttentionSoundSettings,
    'nomi:settings:attention-sound-set': writeAttentionSoundSettings,
    'nomi:settings:project-location-get': () => ({ ok: true, location: getProjectLocationState() }),
    'nomi:settings:project-location-check': () => ({ ok: true, location: getProjectLocationState() }),
    'nomi:assets:list': listProjectAssets,
    'nomi:assets:import-remote-url': async (payload: { projectId: string; url: string }) => {
      authorizeWebProject(surface, payload.projectId)
      if (!/^(?:data:(?:image|video|audio)\/|nomi-local:\/\/asset\/)/.test(payload.url)) throw new Error('Only project-owned or inline media can be imported here')
      const asset = await importRemoteAsset({ ...payload, projectBinding: undefined }, { assertCurrent: () => authorizeWebProject(surface, payload.projectId) })
      return { ok: true, asset }
    },
    'nomi:assets:folders-get': getAssetFolders,
    'nomi:assets:folders-save': saveAssetFolders,
    'nomi:assets:ensure-playable': ensurePlayableAsset,
    'nomi:assets:ensure-preview': ensureLocalAssetPreview,
    'nomi:assets:copy-project-asset': copyProjectAsset,
    'nomi:assets:report-video-codecs': (payload: { codecs?: string[] }) => setProbedVideoCodecs(payload.codecs ?? []),
    'nomi:video:extract-frame': extractVideoFrameToAsset,
    'nomi:video:extract-filmstrip': extractVideoFilmstripToAsset,
    'nomi:web:generation-snapshot': (projectId: string) => { authorizeWebProject(surface, projectId); return generationJobs.snapshot(projectId) },
    'nomi:tasks:comfyui:interrupt': (taskId: string) => generationJobs.cancel(taskId, selection(surface).projectId),
    'nomi:tasks:quote-spend': (inputs: Parameters<typeof prepareSpendQuote>[0]) => { if (!Array.isArray(inputs) || inputs.some(input => !isComfyuiVendor({ key: input.vendorKey }))) throw new Error('Only local ComfyUI is available'); return prepareSpendQuote(inputs) },
    'nomi:tasks:grant-spend': (input: { nodeIds: string[] }) => { const record = projects.readProject(selection(surface).projectId); const nodes = (record?.payload as { generationCanvas?: { nodes?: { id: string }[] } })?.generationCanvas?.nodes ?? []; if (!Array.isArray(input.nodeIds) || input.nodeIds.some(id => !nodes.some(node => node.id === id))) throw new Error('Save the generation targets first'); return { grantId: mintSpendGrant({ nodeIds: input.nodeIds, maxAttemptsPerNode: 1 }) } },
    'nomi:tasks:run': (payload: Parameters<WebGenerationJobs['submit']>[0]) => { authorizeWebProject(surface, String((payload as { request?: { extras?: { projectId?: string } } }).request?.extras?.projectId)); return generationJobs.submit(payload) },
    'nomi:tasks:result': (payload: Parameters<WebGenerationJobs['result']>[0]) => generationJobs.result({ ...payload, projectId: selection(surface).projectId }),

    'nomi:events:append': (payload: { projectId: string; events: Parameters<typeof appendEvents>[1] }) => { const events = appendEvents(payload.projectId, payload.events); return { ok: true, count: events.length, lastSeq: events.at(-1)?.seq ?? 0 } },
    'nomi:events:read': (payload: { projectId: string; fromSeq: number }) => ({ ok: true, events: readEvents(payload.projectId, { fromSeq: payload.fromSeq }) }),
    'nomi:events:generation-eta-stats': (payload: { projectId: string }) => ({ ok: true, stats: deriveGenerationEtaStats(readEvents(payload.projectId)) }),
    'nomi:workspace:sync-inspect': (input: string | { projectId: string }) => { const id = typeof input === 'string' ? input : input.projectId; const root = projects.projectDirById(id); if (!root) throw new Error('Project not found'); return inspectWorkspaceSync(root, id) },
    'nomi:prompt-library:list': async () => ({ ok: true, prompts: await getPromptLibrary({ shouldIncludeSkillPrompts: false }) }),
    'nomi:prompt-library:text-brain': () => ({ ok: false, brain: null, status: 'missing' }),
    'nomi:production-runs:list': () => [],
    'nomi:integration-handoff:list': () => [],
    'nomi:prompt-library:user-list': () => ({ ok: true, prompts: listUserPrompts() }),
    'nomi:prompt-library:user-add': (input: Parameters<typeof addUserPrompt>[0]) => { addUserPrompt(input); return { ok: true, prompts: listUserPrompts() } },
    'nomi:prompt-library:user-update': (payload: { id: string; patch: Parameters<typeof updateUserPrompt>[1] }) => ({ ok: true, prompts: updateUserPrompt(payload.id, payload.patch) }),
    'nomi:prompt-library:user-delete': (payload: { id: string }) => ({ ok: true, prompts: deleteUserPrompt(payload.id) }),
    'nomi:exports:start-job': async (payload: { projectId: string; manifest: unknown; outputName?: string }) => {
      authorizeWebProject(surface, payload.projectId)
      const identity = selection(surface)
      const receipt = await exportJobs.startExportJob(payload, identity)
      if (receipt.backend !== 'filtergraph') { await exportJobs.cancelExportJob(identity, receipt.jobId); throw new Error('This edit cannot be rendered on the server; browser recording is unavailable') }
      const execution = exportJobs.finishExportTempInput(identity, { jobId: receipt.jobId })
      exportExecutions.set(receipt.jobId, execution)
      void execution.catch(error => console.error('Export failed:', receipt.jobId, error instanceof Error ? error.message : String(error)))
      return receipt
    },
    'nomi:exports:finish-temp-input': async (payload: { jobId: string }) => {
      exportJobs.getExportJobStatus(selection(surface), payload.jobId)
      const execution = exportExecutions.get(payload.jobId)
      if (execution) return execution
      const status = exportJobs.getExportJobStatus(selection(surface), payload.jobId)
      if (status.status === 'succeeded' && status.result) return { absolutePath: status.result.outputPath, relativePath: status.result.relativeOutputPath, size: status.result.bytes }
      throw new Error(status.error?.message || 'Export was interrupted; start a new export')
    },
    'nomi:exports:list': () => exportJobs.listExportJobs(selection(surface)),
    'nomi:exports:status': (jobId: string) => exportJobs.getExportJobStatus(selection(surface), jobId),
    'nomi:exports:verify': (jobId: string) => exportJobs.verifyExportJob(selection(surface), jobId),
    'nomi:exports:cancel': (jobId: string) => exportJobs.cancelExportJob(selection(surface), jobId),
  }
  const command = commands[channel as keyof typeof commands]
  if (!command) throw new Error(`This capability is unavailable in the personal web version: ${channel}`)
  return (command as (...args: unknown[]) => unknown)(...args)
}
export function uploadWebAsset(surface: Surface, payload: { projectId: string }, file: File) {
  authorizeWebProject(surface, payload.projectId)
  if (!/^(image|video|audio)\//.test(file.type)) throw new Error('Only image, video and audio files are supported')
  return file.arrayBuffer().then(bytes => ({ ok: true, asset: writeAsset(payload.projectId, Buffer.from(bytes), file.name, file.type, { source: 'upload' }) }))
}
export function initWebDomain() {
  catalog.ensureBuiltinModelSeeds()
  exportJobs.subscribeExportJobEvents(event => hostEvents.emit('message', { channel: 'nomi:exports:event', payload: event }))
  generationJobs.restore()
}
