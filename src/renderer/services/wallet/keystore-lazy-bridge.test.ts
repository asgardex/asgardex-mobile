import { option as O } from 'fp-ts'
import { describe, it, expect, vi, afterEach } from 'vitest'

import type { BiometricNotice } from './keystore-mobile'

/**
 * Tests for the lazy bridge loading in keystore.ts
 *
 * These tests validate that the __internalKeystoreBiometric exports work correctly
 * in both Tauri and non-Tauri environments, and that no `require()` is used.
 */
describe('keystore lazy bridge loading', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  describe('in non-Tauri environment', () => {
    const setupNonTauriEnv = async () => {
      // Mock isTauri to return false (non-Tauri environment)
      vi.doMock('../../../shared/utils/platform', () => ({
        isTauri: vi.fn(() => false),
        isMobile: false,
        getDeviceInfo: () => ({ isMobile: false, type: 'desktop', source: 'default' }),
        setPlatformDevice: vi.fn(),
        resetPlatformDeviceForTests: vi.fn()
      }))

      // Mock the storage/persist dependencies to avoid side effects
      vi.doMock('./keystore-storage', () => ({
        writeNewWalletEntry: vi.fn(),
        resolveEncryptedKeystoreById: vi.fn(),
        resolveEncryptedKeystoreForWallet: vi.fn(),
        removeSecureEntryIfNeeded: vi.fn()
      }))

      vi.doMock('./keystore-persist', () => ({
        persistWalletsOrThrow: vi.fn()
      }))

      vi.doMock('./keystore-runtime-cache', () => ({
        runtimeKeystoreCache: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          clearAll: vi.fn(),
          prune: vi.fn(),
          ensureLifecycleHandlers: vi.fn()
        }
      }))

      // Mock window.apiKeystore to avoid initialization errors
      type WindowApiTest = { apiKeystore?: Window['apiKeystore'] }
      const win = window as unknown as WindowApiTest
      win.apiKeystore = {
        initKeystoreWallets: vi.fn().mockResolvedValue({ _tag: 'Right', right: [] }),
        saveKeystoreWallets: vi.fn().mockResolvedValue({ _tag: 'Right', right: [] }),
        exportKeystore: vi.fn(),
        load: vi.fn()
      } as unknown as Window['apiKeystore']

      const mod = await import('./keystore')
      return mod.__internalKeystoreBiometric
    }

    it('clearBiometricNotice does not throw', async () => {
      const biometric = await setupNonTauriEnv()
      expect(() => biometric.clearBiometricNotice()).not.toThrow()
    })

    it('resolveBiometricOptIn returns false when not in Tauri', async () => {
      const biometric = await setupNonTauriEnv()
      const result = await biometric.resolveBiometricOptIn(true)
      expect(result).toBe(false)
    })

    it('resolveBiometricOptIn returns false for false request', async () => {
      const biometric = await setupNonTauriEnv()
      const result = await biometric.resolveBiometricOptIn(false)
      expect(result).toBe(false)
    })

    it('biometricNotice$ emits O.none and does not crash', async () => {
      const biometric = await setupNonTauriEnv()
      const values: O.Option<BiometricNotice>[] = []

      const sub = biometric.biometricNotice$.subscribe((v) => values.push(v))

      // Give the observable time to emit (async bridge loading)
      await new Promise((r) => setTimeout(r, 50))

      sub.unsubscribe()

      // Should have emitted at least one value (O.none from fallback)
      expect(values.length).toBeGreaterThanOrEqual(1)
      // The emitted value should be O.none in non-Tauri environment
      expect(values[0]).toEqual(O.none)
    })

    it('subscribing multiple times to biometricNotice$ does not crash', async () => {
      const biometric = await setupNonTauriEnv()

      const values1: O.Option<BiometricNotice>[] = []
      const values2: O.Option<BiometricNotice>[] = []

      const sub1 = biometric.biometricNotice$.subscribe((v) => values1.push(v))
      const sub2 = biometric.biometricNotice$.subscribe((v) => values2.push(v))

      await new Promise((r) => setTimeout(r, 50))

      sub1.unsubscribe()
      sub2.unsubscribe()

      // Both subscriptions should work independently
      expect(values1.length).toBeGreaterThanOrEqual(1)
      expect(values2.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('no require() dependency', () => {
    it('does not crash when globalThis.require is undefined', async () => {
      // Save original require if it exists
      const originalRequire = (globalThis as { require?: unknown }).require

      try {
        // Remove require from globalThis
        delete (globalThis as { require?: unknown }).require

        // Mock non-Tauri environment
        vi.doMock('../../../shared/utils/platform', () => ({
          isTauri: vi.fn(() => false),
          isMobile: false,
          getDeviceInfo: () => ({ isMobile: false, type: 'desktop', source: 'default' }),
          setPlatformDevice: vi.fn(),
          resetPlatformDeviceForTests: vi.fn()
        }))

        vi.doMock('./keystore-storage', () => ({
          writeNewWalletEntry: vi.fn(),
          resolveEncryptedKeystoreById: vi.fn(),
          resolveEncryptedKeystoreForWallet: vi.fn(),
          removeSecureEntryIfNeeded: vi.fn()
        }))

        vi.doMock('./keystore-persist', () => ({
          persistWalletsOrThrow: vi.fn()
        }))

        vi.doMock('./keystore-runtime-cache', () => ({
          runtimeKeystoreCache: {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            clearAll: vi.fn(),
            prune: vi.fn(),
            ensureLifecycleHandlers: vi.fn()
          }
        }))

        type WindowApiTest = { apiKeystore?: Window['apiKeystore'] }
        const win = window as unknown as WindowApiTest
        win.apiKeystore = {
          initKeystoreWallets: vi.fn().mockResolvedValue({ _tag: 'Right', right: [] }),
          saveKeystoreWallets: vi.fn().mockResolvedValue({ _tag: 'Right', right: [] }),
          exportKeystore: vi.fn(),
          load: vi.fn()
        } as unknown as Window['apiKeystore']

        // This should not throw even without require
        const mod = await import('./keystore')
        const biometric = mod.__internalKeystoreBiometric

        // Verify the proxy functions work
        expect(() => biometric.clearBiometricNotice()).not.toThrow()
        const result = await biometric.resolveBiometricOptIn(true)
        expect(result).toBe(false)
      } finally {
        // Restore original require if it existed
        if (originalRequire !== undefined) {
          ;(globalThis as { require?: unknown }).require = originalRequire
        }
      }
    })
  })
})
