import { describe, expect, it, vi } from 'vitest'
const { probe } = vi.hoisted(() => ({ probe: vi.fn(async () => ({ ok: true, comfyuiVersion: 'test' })) }))
vi.mock('../electron/comfyuiProbe', () => ({ probeComfyuiSystemStats: probe }))
import { dispatchWebRpc, getWebSurface } from './rpc'
import { readCatalog, ensureBuiltinModelSeeds, upsertModelCatalogVendor } from '../electron/catalog/catalogStore'
import { createWebComfyuiCommands } from './comfyuiConnections'

describe('web connection management through the existing ComfyUI domain', () => {
  it.each(['http://127.0.0.1:19188', 'http://gpu.tailnet.test:8188'])('probes the user-selected server: %s', async address => {
    const surface = getWebSurface('11111111-1111-4111-8111-111111111111', 'http://localhost:9031')
    await expect(dispatchWebRpc('nomi:model-catalog:comfyui:probe', [address], surface)).resolves.toMatchObject({ ok: true })
    expect(probe).toHaveBeenCalledWith(address)
  })
  it('rejects non-ComfyUI writes before altering the catalog', async () => {
    ensureBuiltinModelSeeds()
    const before = readCatalog()
    const surface = getWebSurface('22222222-2222-4222-8222-222222222222', 'http://localhost:9031')
    await expect(dispatchWebRpc('nomi:model-catalog:vendor:upsert', [{ key: 'paid-provider', baseUrlHint: 'https://example.test', authType: 'bearer' }], surface)).rejects.toThrow(/ComfyUI/)
    expect(readCatalog()).toEqual(before)
  })
  it('analyzes malformed workflows with the canonical public result rather than unavailable RPC', async () => {
    const surface = getWebSurface('33333333-3333-4333-8333-333333333333', 'http://localhost:9031')
    await expect(dispatchWebRpc('nomi:model-catalog:comfyui:analyze-workflow', ['not JSON'], surface)).resolves.toMatchObject({ ok: false })
  })
  it('protects the execution contract from vendor/model disable while accepted results are still being collected', () => {
    const key = 'comfyui-local-pending'
    upsertModelCatalogVendor({ key, name: 'Pending GPU', authType: 'none', baseUrlHint: 'http://127.0.0.1:19188', enabled: true })
    const commands = createWebComfyuiCommands(() => true)
    expect(() => commands['nomi:model-catalog:vendor:upsert']({ key, enabled: false })).toThrow('finish')
    expect(() => commands['nomi:model-catalog:model:upsert']({ vendorKey: key, modelKey: 'pending', enabled: false })).toThrow('finish')
  })
})
