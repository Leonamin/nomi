import { describe, expect, it } from 'vitest'
import { rendererCommand } from '../electron/productionRun/productionRunRendererCommand'

describe('production command host authority', () => {
  const command = { commandId: 'human-decision', expectedRevision: 1, type: 'gate.decide', payload: { gateId: 'spend', status: 'approved' }, humanGesture: true }
  it('does not manufacture a trusted desktop gesture from a web command or caller payload', () => {
    expect(rendererCommand(command)).not.toHaveProperty('humanGesture')
  })
  it('retains the gesture only when the desktop IPC caller explicitly attests its trusted sender', () => {
    expect(rendererCommand(command, true)).toHaveProperty('humanGesture', true)
  })
})
