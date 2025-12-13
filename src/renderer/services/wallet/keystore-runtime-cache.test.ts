import { Keystore } from '@xchainjs/xchain-crypto'

import { __internalRuntimeCacheHelpers, runtimeKeystoreCache } from './keystore-runtime-cache'

describe('services/wallet/keystore-runtime-cache', () => {
  const makeKeystore = (id: string): Keystore =>
    ({
      id,
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
    }) as unknown as Keystore

  beforeEach(() => {
    vi.useFakeTimers()
    __internalRuntimeCacheHelpers.resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    __internalRuntimeCacheHelpers.resetForTests()
  })

  it('stores and returns cached keystore', () => {
    const keystore = makeKeystore('k1')
    runtimeKeystoreCache.set(1, keystore)
    expect(runtimeKeystoreCache.get(1)).toBe(keystore)
  })

  it('clears cache after idle TTL', () => {
    runtimeKeystoreCache.set(1, makeKeystore('k1'))
    vi.advanceTimersByTime(__internalRuntimeCacheHelpers.RUNTIME_CACHE_IDLE_MS - 1)
    expect(runtimeKeystoreCache.get(1)).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(runtimeKeystoreCache.get(1)).toBeUndefined()
  })

  it('resets TTL on set', () => {
    runtimeKeystoreCache.set(1, makeKeystore('k1'))
    vi.advanceTimersByTime(__internalRuntimeCacheHelpers.RUNTIME_CACHE_IDLE_MS - 10)
    runtimeKeystoreCache.set(1, makeKeystore('k2'))
    vi.advanceTimersByTime(__internalRuntimeCacheHelpers.RUNTIME_CACHE_IDLE_MS - 1)
    expect(runtimeKeystoreCache.get(1)).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(runtimeKeystoreCache.get(1)).toBeUndefined()
  })

  it('deletes and clears entries', () => {
    runtimeKeystoreCache.set(1, makeKeystore('k1'))
    runtimeKeystoreCache.set(2, makeKeystore('k2'))
    runtimeKeystoreCache.delete(1)
    expect(runtimeKeystoreCache.get(1)).toBeUndefined()
    expect(runtimeKeystoreCache.get(2)).toBeDefined()
    runtimeKeystoreCache.clearAll()
    expect(runtimeKeystoreCache.get(2)).toBeUndefined()
  })

  it('prunes entries not in allow-list', () => {
    runtimeKeystoreCache.set(1, makeKeystore('k1'))
    runtimeKeystoreCache.set(2, makeKeystore('k2'))
    runtimeKeystoreCache.prune(new Set([2]))
    expect(runtimeKeystoreCache.get(1)).toBeUndefined()
    expect(runtimeKeystoreCache.get(2)).toBeDefined()
  })
})
