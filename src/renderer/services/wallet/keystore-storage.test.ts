import { Keystore } from '@xchainjs/xchain-crypto'
import { either as E, option as O } from 'fp-ts'
import { of } from 'rxjs'

import { SecureKeystoreWallet } from '../../../shared/api/io'
import type { SecureStoragePayload, SecureStorageApi } from '../../../shared/api/types'
import type { KeystoreMobileBridge } from './keystore-mobile'

type MockSecure = {
  write: ReturnType<typeof vi.fn>
  read: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  exists: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
}

describe('services/wallet/keystore-storage', () => {
  const makeKeystore = (): Keystore => ({ id: 'k', version: 3 }) as unknown as Keystore

  let mockBridge: Partial<KeystoreMobileBridge>
  let recordSecureStorageEvent: ReturnType<typeof vi.fn>

  type WindowApiTest = {
    apiKeystore?: { secure?: SecureStorageApi; saveKeystoreWallets?: unknown; initKeystoreWallets?: unknown }
    apiSecure?: SecureStorageApi
  }
  const win = window as unknown as WindowApiTest

  const setupModule = async () => {
    vi.resetModules()

    recordSecureStorageEvent = vi.fn()
    vi.doMock('../app/telemetry', () => ({
      recordSecureStorageEvent
    }))

    vi.doMock('./keystore-mobile', () => ({
      getKeystoreMobileBridge: () => mockBridge as KeystoreMobileBridge
    }))

    const cacheMap = new Map<number, Keystore>()
    vi.doMock('./keystore-runtime-cache', () => ({
      runtimeKeystoreCache: {
        get: (id: number) => cacheMap.get(id),
        set: (id: number, keystore: Keystore) => {
          cacheMap.set(id, keystore)
        },
        delete: (id: number) => {
          cacheMap.delete(id)
        },
        clearAll: () => {
          cacheMap.clear()
        },
        prune: (allowed: Set<number>) => {
          Array.from(cacheMap.keys()).forEach((key) => {
            if (!allowed.has(key)) cacheMap.delete(key)
          })
        },
        ensureLifecycleHandlers: vi.fn()
      }
    }))

    return import('./keystore-storage')
  }

  beforeEach(() => {
    mockBridge = {
      resolveBiometricOptIn: vi.fn(async (requested: boolean) => requested),
      shouldBlockOnSecureFailure: vi.fn(() => false),
      emitBiometricNotice: vi.fn(),
      biometricNotice$: of(O.none),
      clearBiometricNotice: vi.fn()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete win.apiSecure
    delete win.apiKeystore
  })

  it('prefers window.apiKeystore.secure over window.apiSecure', async () => {
    const secureA = {} as unknown as SecureStorageApi
    const secureB = {} as unknown as SecureStorageApi
    win.apiKeystore = {
      secure: secureA,
      saveKeystoreWallets: vi.fn(),
      initKeystoreWallets: vi.fn().mockResolvedValue(E.right([]))
    }
    win.apiSecure = secureB

    const mod = await setupModule()
    expect(mod.getSecureStorageApi()).toBe(secureA)
  })

  it('resolves secure wallet from secure storage and caches it', async () => {
    const secure: MockSecure = {
      write: vi.fn(),
      read: vi.fn().mockResolvedValue({ type: 'keystore', keystore: makeKeystore() }),
      remove: vi.fn(),
      exists: vi.fn(),
      list: vi.fn()
    }

    win.apiKeystore = { secure: secure as unknown as SecureStorageApi }

    const mod = await setupModule()

    const wallet: SecureKeystoreWallet = {
      id: 1,
      name: 'w1',
      selected: false,
      secureKeyId: 'secure-key',
      biometricEnabled: false,
      lastSecureWriteAt: 'now',
      lastSecureWriteStatus: 'success',
      exportAcknowledgedAt: null,
      lastExportAction: null,
      lastExportActionAt: null
    }

    const k1 = await mod.resolveEncryptedKeystoreForWallet(wallet)
    const k2 = await mod.resolveEncryptedKeystoreForWallet(wallet)

    expect(k1).toBeDefined()
    expect(k2).toBe(k1)
    expect(secure.read).toHaveBeenCalledTimes(1)
  })

  it('emits notice on biometric downgrade errors during unlock', async () => {
    const secure: MockSecure = {
      write: vi.fn(),
      read: vi.fn(),
      remove: vi.fn(),
      exists: vi.fn(),
      list: vi.fn()
    }
    win.apiKeystore = { secure: secure as unknown as SecureStorageApi }

    const mod = await setupModule()
    const { BiometricDowngradeError } = await import('../../../shared/errors/biometric')
    const payload: SecureStoragePayload = { type: 'keystore', keystore: makeKeystore() }
    const downgrade = new BiometricDowngradeError('downgrade', {
      secureKeyId: 'secure-key',
      reason: 'pluginUnavailable',
      payload
    })
    secure.read.mockRejectedValue(downgrade)

    const wallet: SecureKeystoreWallet = {
      id: 1,
      name: 'w1',
      selected: false,
      secureKeyId: 'secure-key',
      biometricEnabled: true,
      lastSecureWriteAt: 'now',
      lastSecureWriteStatus: 'success'
    }

    await expect(mod.resolveEncryptedKeystoreForWallet(wallet)).rejects.toBe(downgrade)
    expect(mockBridge.emitBiometricNotice).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'unlock', reason: 'pluginUnavailable', secureKeyId: 'secure-key' })
    )
    expect(recordSecureStorageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'biometric_downgrade_consumed', secureKeyId: 'secure-key' })
    )
  })

  it('writes secure wallet and provides rollback', async () => {
    const secure: MockSecure = {
      write: vi.fn().mockResolvedValue({ secureKeyId: 'k', updatedAt: 't' }),
      read: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      list: vi.fn()
    }
    win.apiKeystore = { secure: secure as unknown as SecureStorageApi }

    const mod = await setupModule()
    const result = await mod.writeNewWalletEntry({
      id: 1,
      name: 'w1',
      keystore: makeKeystore(),
      biometricEnabled: true
    })

    expect(result.storageMode).toBe('secure')
    if (result.storageMode !== 'secure') throw new Error('Expected secure storage mode')
    expect(result.wallet.secureKeyId).toBe('k')
    expect(result.rollback).toBeTypeOf('function')
    await result.rollback()
    expect(secure.remove).toHaveBeenCalledWith('k')
  })

  it('blocks onboarding when policy requires secure storage', async () => {
    const secure: MockSecure = {
      write: vi.fn().mockRejectedValue(new Error('fail')),
      read: vi.fn(),
      remove: vi.fn(),
      exists: vi.fn(),
      list: vi.fn()
    }
    win.apiKeystore = { secure: secure as unknown as SecureStorageApi }
    mockBridge.shouldBlockOnSecureFailure = vi.fn(() => true)

    const mod = await setupModule()
    await expect(mod.writeNewWalletEntry({ id: 1, name: 'w1', keystore: makeKeystore() })).rejects.toMatchObject({
      name: 'SecureStorageRequiredError'
    })
  })

  it('falls back to legacy wallet when secure write fails and policy allows', async () => {
    const secure: MockSecure = {
      write: vi.fn().mockRejectedValue(new Error('fail')),
      read: vi.fn(),
      remove: vi.fn(),
      exists: vi.fn(),
      list: vi.fn()
    }
    win.apiKeystore = { secure: secure as unknown as SecureStorageApi }

    const mod = await setupModule()
    const result = await mod.writeNewWalletEntry({ id: 1, name: 'w1', keystore: makeKeystore() })
    expect(result.storageMode).toBe('legacy')
    if (result.storageMode !== 'legacy') throw new Error('Expected legacy storage mode')
    expect(result.wallet.keystore).toBeDefined()
  })

  it('removes secure entry and records telemetry (best-effort)', async () => {
    const secure: MockSecure = {
      write: vi.fn(),
      read: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      list: vi.fn()
    }
    win.apiKeystore = { secure: secure as unknown as SecureStorageApi }

    const mod = await setupModule()
    const wallet: SecureKeystoreWallet = {
      id: 1,
      name: 'w1',
      selected: false,
      secureKeyId: 'secure-key',
      biometricEnabled: false,
      lastSecureWriteAt: 'now',
      lastSecureWriteStatus: 'success'
    }

    await mod.removeSecureEntryIfNeeded(wallet)
    expect(secure.remove).toHaveBeenCalledWith('secure-key')
    expect(recordSecureStorageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'remove', walletId: 1, secureKeyId: 'secure-key' })
    )
  })
})
