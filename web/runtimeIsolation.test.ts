import path from 'node:path'
import { expect, it } from 'vitest'
import './runtimeHost'
import { capabilityCoreDir } from '../electron/capabilityCore/security'

it('keeps capability tokens, signing keys and approval receipts in the dedicated web profile', () => {
  expect(capabilityCoreDir()).toBe(path.join(process.env.NOMI_WEB_DATA_DIR!, 'profile/capability-core'))
})
