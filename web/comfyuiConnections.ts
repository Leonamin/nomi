import { z } from 'zod'
import * as catalog from '../electron/catalog/catalogStore'
import { upsertRendererCatalogVendor, upsertRendererCatalogModel } from '../electron/catalog/rendererCatalogMutation'
import { isComfyuiVendor } from '../electron/catalog/types'
import { probeComfyuiSystemStats } from '../electron/comfyuiProbe'
import { analyzeComfyWorkflowText, analyzeComfyWorkflowTextSmart, reconcileComfyWorkflowText, reconcileComfyWorkflowTexts } from '../electron/catalog/comfyuiWorkflowImportStore'
import { listComfyuiPresets } from '../electron/catalog/comfyuiPresets'
import { fetchComfyuiTemplates, fetchComfyuiTemplateDetail } from '../electron/comfyuiTemplates'
import { getConnectionCertificationService } from '../electron/integrationCertification/service'
import { installIntegrationSessionRuntime } from '../electron/integrationCertification/integrationSessionRuntimeInstall'
import type { IntegrationSessionService } from '../electron/integrationCertification/integrationSession'
import { listIntegrationHandoffs, acknowledgeIntegrationHandoff } from '../electron/integrationCertification/handoffQueue'
import { runComfyCandidateTest, cancelComfyCandidateTest, failComfyCandidateEnvelope } from '../electron/tasks/comfyCandidateTest'
import { runTask, fetchTaskResult } from '../electron/runtime'
import { hostEvents } from './runtimeHost'

let integration: IntegrationSessionService | undefined
const pendingCandidateTests = new Map<string, number>()
export function initWebConnections() { integration ??= installIntegrationSessionRuntime() }
function sessions() { initWebConnections(); return integration! }
const objectSchema = z.record(z.unknown())
const addressSchema = z.string().trim().url().refine(value => {
  const url = new URL(value)
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash
}, 'ComfyUI requires an HTTP(S) server address without credentials or query parameters')
function vendor(key: unknown) {
  const name = z.string().trim().min(1).parse(key)
  const row = catalog.readCatalog().vendors.find(item => item.key === name)
  if (!row || !isComfyuiVendor(row) || row.authType !== 'none') throw new Error('Only local, keyless ComfyUI connections can be managed here')
  return row
}
function announce<T>(value: T): T {
  hostEvents.emit('message', { channel: 'nomi:model-catalog:changed', payload: null })
  return value
}
function workflowInput(raw: unknown) {
  const input = objectSchema.parse(raw)
  const key = typeof input.vendorKey === 'string' ? input.vendorKey : 'comfyui-local'
  vendor(key)
  return {
    workflowText: z.string().min(1).max(8_000_000).parse(input.text),
    binding: (input.binding || { numeric: [] }) as Parameters<ReturnType<typeof getConnectionCertificationService>['stageComfyWorkflow']>[0]['binding'],
    labelZh: z.string().min(1).max(200).parse(input.labelZh || 'ComfyUI workflow'),
    vendorKey: key,
    ...(input.enumOptions ? { enumOptions: input.enumOptions as never } : {}),
    ...(typeof input.uiWorkflowText === 'string' ? { uiWorkflowText: input.uiWorkflowText } : {}),
  }
}

/** Complete ComfyUI management surface; the desktop catalog/parser/certification remain the owners. */
export function createWebComfyuiCommands(hasPendingConnection: (key: string) => boolean) {
  const isPending = (key: string) => {
    const connection = vendor(key)
    return hasPendingConnection(key) || Boolean(pendingCandidateTests.get(String(connection.baseUrlHint))) || (integration?.list('nomi', 10000).sessions.some(session => ['certifying', 'committing'].includes(session.stage) && session.config.baseUrl === connection.baseUrlHint) ?? false)
  }
  return {
    'nomi:model-catalog:vendor:upsert': (raw: unknown) => {
      const input = objectSchema.parse(raw)
      const key = z.string().trim().min(1).parse(input.key)
      if (!isComfyuiVendor({ key }) || (input.authType !== undefined && input.authType !== 'none')) throw new Error('Only keyless ComfyUI connections can be managed here')
      const current = catalog.readCatalog().vendors.find(row => row.key === key)
      if (current && current.authType !== 'none') throw new Error('Only keyless ComfyUI connections can be managed here')
      const baseUrlHint = input.baseUrlHint !== undefined ? addressSchema.parse(input.baseUrlHint) : current?.baseUrlHint || 'http://127.0.0.1:8188'
      if (current && isPending(key) && (baseUrlHint !== current.baseUrlHint || (typeof input.enabled === 'boolean' && input.enabled !== current.enabled))) throw new Error('Wait for this ComfyUI generation to finish before changing the connection')
      return announce(upsertRendererCatalogVendor({ ...input, key, authType: 'none', baseUrlHint }))
    },
    'nomi:model-catalog:vendor:delete': (key: string) => { vendor(key); if (isPending(key)) throw new Error('Wait for this ComfyUI generation to finish before removing the connection'); return announce(catalog.deleteModelCatalogVendor(key)) },
    'nomi:model-catalog:model:upsert': (raw: unknown) => { const input = objectSchema.parse(raw); const connection = vendor(input.vendorKey); if (isPending(connection.key)) throw new Error('Wait for this ComfyUI generation to finish before changing the workflow'); return announce(upsertRendererCatalogModel(input)) },
    'nomi:model-catalog:model:delete': (key: string, modelKey: string) => { vendor(key); if (isPending(key)) throw new Error('Wait for this ComfyUI generation to finish before removing the workflow'); return announce(catalog.deleteModelCatalogModel(key, modelKey)) },
    'nomi:model-catalog:models:delete': (raw: unknown) => { const targets = z.array(z.object({ vendorKey: z.string(), modelKey: z.string() }).strict()).parse(raw); targets.forEach(target => { vendor(target.vendorKey); if (isPending(target.vendorKey)) throw new Error('Wait for this ComfyUI generation to finish before removing workflows') }); return announce(catalog.deleteModelCatalogModels(targets)) },
    'nomi:model-catalog:comfyui:probe': (address: unknown) => probeComfyuiSystemStats(addressSchema.parse(address)),
    'nomi:model-catalog:comfyui:analyze-workflow': analyzeComfyWorkflowText,
    'nomi:model-catalog:comfyui:analyze-workflow-smart': (text: unknown, key: unknown) => { vendor(key || 'comfyui-local'); return analyzeComfyWorkflowTextSmart(text, key) },
    'nomi:model-catalog:comfyui:reconcile-workflow': (text: unknown, key: unknown) => { vendor(key || 'comfyui-local'); return reconcileComfyWorkflowText(text, key) },
    'nomi:model-catalog:comfyui:reconcile-workflows': (items: unknown, key: unknown) => { vendor(key || 'comfyui-local'); return reconcileComfyWorkflowTexts(items, key) },
    'nomi:model-catalog:comfyui:presets': listComfyuiPresets,
    'nomi:model-catalog:comfyui:templates': (key: unknown) => fetchComfyuiTemplates(String(vendor(key || 'comfyui-local').baseUrlHint)),
    'nomi:model-catalog:comfyui:template-detail': (name: unknown, key: unknown) => fetchComfyuiTemplateDetail(String(vendor(key || 'comfyui-local').baseUrlHint), z.string().parse(name)),
    'nomi:model-catalog:comfyui:import-workflow': (raw: unknown) => announce(getConnectionCertificationService().stageComfyWorkflow(workflowInput(raw))),
    'nomi:model-catalog:comfyui:update-workflow': (raw: unknown) => { const input = objectSchema.parse(raw); const workflow = workflowInput(raw); if (isPending(workflow.vendorKey)) throw new Error('Wait for this ComfyUI generation to finish before changing the workflow'); return announce(getConnectionCertificationService().updateComfyWorkflow({ ...workflow, modelKey: z.string().min(1).parse(input.modelKey) })) },
    'nomi:integration-handoff:list': listIntegrationHandoffs,
    'nomi:integration-handoff:ack': acknowledgeIntegrationHandoff,
    'nomi:integration-session:get': (raw: unknown) => sessions().get(z.string().parse(objectSchema.parse(raw).sessionId)),
    'nomi:integration-session:comfyui:prepare': (raw: unknown) => {
      const input = objectSchema.parse(raw)
      const connection = vendor(input.vendorKey)
      const modelKey = typeof input.modelKey === 'string' ? input.modelKey : undefined
      if (modelKey && !catalog.readCatalog().models.some(model => model.vendorKey === connection.key && model.modelKey === modelKey)) throw new Error('Workflow does not belong to this connection')
      const service = sessions()
      const created = service.begin({ kind: 'comfyui-workflow', name: String(input.name || 'ComfyUI workflow'), baseUrl: String(connection.baseUrlHint) }, 'nomi')
      const submitted = service.submitWorkflow(created.id, created.revision, 'nomi', String(input.workflow || ''), input.binding, {
        ...(input.enumOptions !== undefined ? { enumOptions: input.enumOptions } : {}), ...(modelKey ? { modelKey } : {}),
        ...(typeof input.uiWorkflow === 'string' ? { uiWorkflow: input.uiWorkflow } : {}),
      })
      const ready = service.resolveInput(submitted.id, submitted.revision, 'nomi', {})
      return service.get(ready.id)
    },
    'nomi:integration-session:start-self-check': async (raw: unknown) => { const input = objectSchema.parse(raw); return announce(await sessions().start(z.string().parse(input.sessionId), z.number().int().parse(input.expectedRevision), 'nomi', `manual-${input.sessionId}`)) },
    'nomi:tasks:comfy-candidate-test': async (raw: unknown) => {
      const input = objectSchema.parse(raw); const connection = vendor(input.vendor)
      const address = String(connection.baseUrlHint)
      pendingCandidateTests.set(address, (pendingCandidateTests.get(address) || 0) + 1)
      try { return announce(await runComfyCandidateTest(raw, { runTask, fetchTaskResult })) }
      catch (error) { return failComfyCandidateEnvelope(raw, 'provider_failed', error) }
      finally { const remaining = (pendingCandidateTests.get(address) || 1) - 1; if (remaining) pendingCandidateTests.set(address, remaining); else pendingCandidateTests.delete(address) }
    },
    'nomi:tasks:comfy-candidate-cancel': (raw: unknown) => { const result = cancelComfyCandidateTest(raw); failComfyCandidateEnvelope(raw, 'candidate_cancelled'); return announce(result) },
  }
}
