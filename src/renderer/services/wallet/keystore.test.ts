import { Keystore } from '@xchainjs/xchain-crypto'
import { either as E } from 'fp-ts'

describe('services/wallet/keystore orchestration', () => {
  const fakeKeystore: Keystore = {
    id: 'k',
    version: 3,
    crypto: {
      cipher: 'aes-128-ctr',
      ciphertext: 'deadbeef',
      cipherparams: { iv: 'deadbeef' },
      kdf: 'scrypt',
      kdfparams: { prf: 'hmac-sha256', dklen: 32, salt: 'salt', c: 1 },
      mac: 'mac'
    },
    meta: ''
  } as unknown as Keystore

  const setup = async () => {
    vi.resetModules()

    const writeNewWalletEntry = vi.fn().mockResolvedValue({
      wallet: { id: 1, name: 'w1', keystore: fakeKeystore, selected: false },
      storageMode: 'legacy'
    })
    const resolveEncryptedKeystoreById = vi.fn().mockResolvedValue(fakeKeystore)
    const resolveEncryptedKeystoreForWallet = vi.fn().mockResolvedValue(fakeKeystore)
    const removeSecureEntryIfNeeded = vi.fn().mockResolvedValue(undefined)

    const persistWalletsOrThrow = vi.fn().mockResolvedValue(undefined)

    const runtimeKeystoreCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clearAll: vi.fn(),
      prune: vi.fn(),
      ensureLifecycleHandlers: vi.fn()
    }

    vi.doMock('@xchainjs/xchain-crypto', () => ({
      encryptToKeyStore: vi.fn().mockResolvedValue(fakeKeystore),
      decryptFromKeystore: vi.fn().mockResolvedValue('phrase'),
      Keystore: {}
    }))

    vi.doMock('./keystore-storage', () => ({
      writeNewWalletEntry,
      resolveEncryptedKeystoreById,
      resolveEncryptedKeystoreForWallet,
      removeSecureEntryIfNeeded
    }))

    vi.doMock('./keystore-persist', () => ({
      persistWalletsOrThrow
    }))

    vi.doMock('./keystore-runtime-cache', () => ({
      runtimeKeystoreCache
    }))
    type WindowApiTest = { apiKeystore?: Window['apiKeystore'] }
    const win = window as unknown as WindowApiTest
    win.apiKeystore = {
      initKeystoreWallets: vi.fn().mockResolvedValue(E.right([])),
      saveKeystoreWallets: vi.fn().mockResolvedValue(E.right([])),
      exportKeystore: vi.fn(),
      load: vi.fn().mockResolvedValue(fakeKeystore)
    } as unknown as Window['apiKeystore']

    const mod = await import('./keystore')
    return {
      keystoreService: mod.keystoreService,
      mocks: {
        writeNewWalletEntry,
        resolveEncryptedKeystoreById,
        persistWalletsOrThrow,
        runtimeKeystoreCache
      }
    }
  }

  it('addKeystoreWallet delegates to storage and persist seams', async () => {
    const { keystoreService, mocks } = await setup()

    await keystoreService.addKeystoreWallet({
      phrase: 'phrase',
      name: 'w1',
      id: 1,
      password: 'pw',
      biometricEnabled: true
    })

    expect(mocks.writeNewWalletEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'w1', keystore: fakeKeystore, biometricEnabled: true })
    )
    expect(mocks.persistWalletsOrThrow).toHaveBeenCalledTimes(1)
  })

  it('unlock delegates to resolver and decrypt', async () => {
    const { keystoreService, mocks } = await setup()

    await keystoreService.addKeystoreWallet({ phrase: 'phrase', name: 'w1', id: 1, password: 'pw' })
    await keystoreService.lock()
    await keystoreService.unlock('pw')

    expect(mocks.resolveEncryptedKeystoreById).toHaveBeenCalledWith(expect.any(Array), 1)
  })

  it('lock clears runtime cache for wallet id', async () => {
    const { keystoreService, mocks } = await setup()

    await keystoreService.addKeystoreWallet({ phrase: 'phrase', name: 'w1', id: 1, password: 'pw' })
    await keystoreService.lock()

    expect(mocks.runtimeKeystoreCache.delete).toHaveBeenCalledWith(1)
  })
})
