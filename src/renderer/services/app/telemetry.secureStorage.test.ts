import { recordSecureStorageEvent } from './telemetry'

describe('services/app/telemetry secure storage redaction', () => {
  it('redacts sensitive metadata keys and hashes secureKeyId', () => {
    const event = recordSecureStorageEvent({
      action: 'unlock_failure',
      secureKeyId: 'secure-entry-raw',
      metadata: {
        raw: 'should-not-leak',
        payload: { type: 'keystore', keystore: { secret: 'nope' } },
        keystore: { crypto: 'nope' },
        phrase: 'nope',
        ok: 'yes'
      }
    })

    expect(event.secureKeyId).not.toBe('secure-entry-raw')
    expect(event.secureKeyId).toMatch(/^[0-9a-f]{64}$/)
    expect(event.metadata?.raw).toBe('[redacted]')
    expect(event.metadata?.payload).toBe('[redacted]')
    expect(event.metadata?.keystore).toBe('[redacted]')
    expect(event.metadata?.phrase).toBe('[redacted]')
    expect(event.metadata?.ok).toBe('yes')
  })
})
