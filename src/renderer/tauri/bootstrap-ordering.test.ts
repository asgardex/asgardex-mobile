/**
 * Bootstrap Ordering Invariant Tests
 *
 * These tests validate that the window.api* surface exists and behaves correctly.
 * They document the critical invariant: windowApi.ts MUST load before any service
 * module that accesses window.api*.
 *
 * The bootstrap sequence in index.tsx guarantees this via dynamic import:
 *   1. await import('./tauri/windowApi')  ← attaches window.api*
 *   2. await import('./App')               ← services can now access window.api*
 *
 * If this ordering breaks (e.g., during a rebase), services will encounter
 * undefined window.api* properties, leading to runtime crashes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { getSecureStorageApi } from '../services/wallet/keystore-storage'

describe('Bootstrap Ordering Invariants', () => {
  describe('window.api* surface availability', () => {
    it('window.apiKeystore is defined after windowApi loads', async () => {
      // In the test environment, windowApi is loaded via setup or mock.
      // This test validates the invariant: if windowApi hasn't loaded,
      // window.apiKeystore would be undefined.
      expect(window.apiKeystore).toBeDefined()
      expect(typeof window.apiKeystore).toBe('object')
    })

    it('window.apiKeystore.secure is defined after windowApi loads', async () => {
      // The secure storage API is accessed via window.apiKeystore.secure (primary)
      // or window.apiSecure (fallback). The test mock provides it via apiKeystore.secure.
      expect(window.apiKeystore.secure).toBeDefined()
      expect(typeof window.apiKeystore.secure).toBe('object')
    })

    it('window.apiUrl is defined after windowApi loads', async () => {
      expect(window.apiUrl).toBeDefined()
      expect(typeof window.apiUrl.openExternal).toBe('function')
    })

    it('window.apiHDWallet is defined after windowApi loads', async () => {
      expect(window.apiHDWallet).toBeDefined()
      expect(typeof window.apiHDWallet).toBe('object')
    })

    it('storage APIs are defined after windowApi loads', async () => {
      expect(window.apiCommonStorage).toBeDefined()
      expect(window.apiChainStorage).toBeDefined()
      expect(window.apiAssetStorage).toBeDefined()
      expect(window.apiAddressStorage).toBeDefined()
      expect(window.apiUserNodesStorage).toBeDefined()
      expect(window.apiUserBondProvidersStorage).toBeDefined()
      expect(window.apiPoolsStorage).toBeDefined()
    })
  })

  describe('getSecureStorageApi accessor', () => {
    /**
     * This test validates that the keystore-storage module's accessor
     * correctly retrieves the secure storage API from the window surface.
     *
     * If windowApi hasn't loaded, getSecureStorageApi() would return null,
     * causing services to fall back to legacy storage or fail.
     */
    it('returns a valid SecureStorageApi when window.api* is available', () => {
      const api = getSecureStorageApi()
      expect(api).not.toBeNull()
      expect(typeof api?.read).toBe('function')
      expect(typeof api?.write).toBe('function')
      expect(typeof api?.remove).toBe('function')
      expect(typeof api?.exists).toBe('function')
      expect(typeof api?.list).toBe('function')
    })
  })

  describe('getSecureStorageApi without window.api*', () => {
    /**
     * This test documents what happens if windowApi hasn't loaded:
     * the accessor returns null, which would cause service failures.
     *
     * This is the "canary" test - if someone refactors the bootstrap
     * sequence incorrectly, this invariant would break.
     */
    let originalApiKeystore: typeof window.apiKeystore

    beforeEach(() => {
      // Save originals
      originalApiKeystore = window.apiKeystore
      // Simulate uninitialized state (both apiKeystore and apiSecure missing)
      delete (window as Partial<typeof window>).apiKeystore
      delete (window as Partial<typeof window>).apiSecure
    })

    afterEach(() => {
      // Restore
      window.apiKeystore = originalApiKeystore
    })

    it('returns null when window.api* is not initialized', () => {
      const api = getSecureStorageApi()
      expect(api).toBeNull()
    })
  })
})
