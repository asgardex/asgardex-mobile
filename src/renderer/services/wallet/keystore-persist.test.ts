import { either as E } from 'fp-ts'

import * as telemetry from '../app/telemetry'
import { persistWalletsOrThrow } from './keystore-persist'

describe('services/wallet/keystore-persist', () => {
  type WindowApiTest = { apiKeystore?: Window['apiKeystore'] }
  const win = window as unknown as WindowApiTest

  beforeEach(() => {
    vi.spyOn(telemetry, 'recordSecureStorageEvent')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete win.apiKeystore
  })

  it('resolves when persist returns Right', async () => {
    win.apiKeystore = {
      saveKeystoreWallets: vi.fn().mockResolvedValue(E.right([]))
    } as unknown as Window['apiKeystore']

    await expect(persistWalletsOrThrow([])).resolves.toBeUndefined()
  })

  it('throws when persist returns Left and emits telemetry', async () => {
    win.apiKeystore = {
      saveKeystoreWallets: vi.fn().mockResolvedValue(E.left(new Error('disk-failed')))
    } as unknown as Window['apiKeystore']

    await expect(persistWalletsOrThrow([], { action: 'test', walletId: 1, secureKeyId: 'k' })).rejects.toThrow(
      'Could not persist wallets'
    )

    expect(telemetry.recordSecureStorageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'write_persist_failure', walletId: 1, secureKeyId: 'k' })
    )
  })

  it('runs rollback on persist failure', async () => {
    const rollback = vi.fn().mockResolvedValue(undefined)
    win.apiKeystore = {
      saveKeystoreWallets: vi.fn().mockResolvedValue(E.left(new Error('disk-failed')))
    } as unknown as Window['apiKeystore']

    await expect(persistWalletsOrThrow([], { action: 'test', walletId: 1 }, rollback)).rejects.toThrow(
      'Could not persist wallets'
    )

    expect(rollback).toHaveBeenCalledTimes(1)
  })

  it('does not mask original persist error when rollback fails', async () => {
    const rollback = vi.fn().mockRejectedValue(new Error('rollback-failed'))
    win.apiKeystore = {
      saveKeystoreWallets: vi.fn().mockResolvedValue(E.left(new Error('disk-failed')))
    } as unknown as Window['apiKeystore']

    await expect(persistWalletsOrThrow([], { action: 'test', walletId: 1 }, rollback)).rejects.toThrow(
      'Could not persist wallets'
    )
  })
})
