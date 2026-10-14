import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { createApprovalReceiptAuthority } from '../electron/capabilityCore/approvalReceipt'
describe('web human approval evidence', () => {
  it('records the actual web session and rejects modified session/origin evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-web-approval-'))
    const authority = createApprovalReceiptAuthority({ filePath: path.join(root, 'receipts.json'), macKey: 'test-secret' })
    const { token } = authority.requestChallenge({ challengeKey: 'web-action', immutableProjectUuid: 'project-uuid', projectGeneration: 1, projectId: 'project', runId: 'run', gateId: 'gate', contractHash: 'hash', targetHash: 'hash', projectRevision: 1, costScope: 'generation', pricingSnapshotHash: 'price', reservationPreview: { currency: 'CNY', maximum: 0, unknownJobCount: 1 } })
    const gesture = authority.createWebSessionGestureAttestation(token, { surfaceId: 'surface-server-issued', clientSessionId: 'session-server-issued', origin: 'https://hamsbox.example:8445', decision: 'accept' })
    expect(() => authority.mintReceipt(token, { ...gesture, clientSessionId: 'other-session' })).toThrow()
    expect(() => authority.mintReceipt(token, { ...gesture, origin: 'https://other.example' })).toThrow()
    const receipt = authority.mintReceipt(token, gesture).receipt
    expect(receipt.decidedBy).toBe('human:web_session')
    expect(receipt.humanActor).toBe('web_session:surface-server-issued:session-server-issued:https://hamsbox.example:8445')
    expect(receipt.gestureAttestation).not.toHaveProperty('webContentsId')
    fs.rmSync(root, { recursive: true, force: true })
  })
  it('refuses incomplete identities and non-origin URLs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-web-approval-'))
    const authority = createApprovalReceiptAuthority({ filePath: path.join(root, 'receipts.json'), macKey: 'test-secret' })
    const { token } = authority.requestChallenge({ challengeKey: 'web-action', immutableProjectUuid: 'project-uuid', projectGeneration: 1, projectId: 'project', runId: 'run', gateId: 'gate', contractHash: 'hash', targetHash: 'hash', projectRevision: 1, costScope: 'generation', pricingSnapshotHash: 'price', reservationPreview: { currency: 'CNY', maximum: 0 } })
    expect(() => authority.createWebSessionGestureAttestation(token, { surfaceId: '', clientSessionId: 'session', origin: 'https://hamsbox.example', decision: 'accept' })).toThrow()
    expect(() => authority.createWebSessionGestureAttestation(token, { surfaceId: 'surface', clientSessionId: 'session', origin: 'https://hamsbox.example/path', decision: 'accept' })).toThrow()
    fs.rmSync(root, { recursive: true, force: true })
  })
})
