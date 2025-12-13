import { option as O } from 'fp-ts'

import type { BiometricNotice } from './keystore-mobile'

type TestEnvContainer = { __TAURI_TEST_IMPORT_META_ENV__?: Record<string, unknown> }

const setTestEnv = (env: Record<string, unknown>) => {
  ;(globalThis as TestEnvContainer).__TAURI_TEST_IMPORT_META_ENV__ = env
}

describe('services/wallet/keystore-mobile', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    ;(globalThis as TestEnvContainer).__TAURI_TEST_IMPORT_META_ENV__ = undefined
  })

  it('shouldBlockOnSecureFailure respects secure storage flag and device type', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({
      isMobile: false,
      getDeviceInfo: () => ({ isMobile: true })
    }))

    setTestEnv({ VITE_TAURI_SECURE_STORAGE_ENABLED: false })
    const mod1 = await import('./keystore-mobile')
    expect(mod1.shouldBlockOnSecureFailure()).toBe(false)

    vi.resetModules()
    setTestEnv({ VITE_TAURI_SECURE_STORAGE_ENABLED: '1' })
    const mod2 = await import('./keystore-mobile')
    expect(mod2.shouldBlockOnSecureFailure()).toBe(true)

    vi.resetModules()
    vi.doMock('../../../shared/utils/platform', () => ({
      isMobile: false,
      getDeviceInfo: () => ({ isMobile: false })
    }))
    setTestEnv({ VITE_TAURI_SECURE_STORAGE_ENABLED: true })
    const mod3 = await import('./keystore-mobile')
    expect(mod3.shouldBlockOnSecureFailure()).toBe(false)
  })

  it('resolveBiometricOptIn returns false when not requested', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({
      isMobile: true,
      getDeviceInfo: () => ({ isMobile: true })
    }))
    vi.doMock('../../../shared/config/biometric', () => ({
      isBiometricEnabled: () => true
    }))
    setTestEnv({ VITE_TAURI_SECURE_STORAGE_ENABLED: true })
    const mod = await import('./keystore-mobile')
    const bridge = mod.getKeystoreMobileBridge()
    await expect(bridge.resolveBiometricOptIn(false)).resolves.toBe(false)
  })

  it('resolveBiometricOptIn returns false and emits notice on plugin import failure', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({
      isMobile: true,
      getDeviceInfo: () => ({ isMobile: true })
    }))
    vi.doMock('../../../shared/config/biometric', () => ({
      isBiometricEnabled: () => true
    }))
    vi.doMock('@tauri-apps/plugin-biometric', () => {
      throw new Error('missing')
    })

    const mod = await import('./keystore-mobile')
    const bridge = mod.getKeystoreMobileBridge()

    let latest: O.Option<BiometricNotice> = O.none
    const sub = bridge.biometricNotice$.subscribe((v) => {
      latest = v
    })
    await bridge.resolveBiometricOptIn(true)
    sub.unsubscribe()

    expect(latest).toEqual(O.some({ reason: 'pluginUnavailable', surface: 'onboarding', secureKeyId: 'pending' }))
  })

  it('resolveBiometricOptIn returns false and emits notice on status downgrade', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({
      isMobile: true,
      getDeviceInfo: () => ({ isMobile: true })
    }))
    vi.doMock('../../../shared/config/biometric', () => ({
      isBiometricEnabled: () => true
    }))
    vi.doMock('@tauri-apps/plugin-biometric', () => ({
      checkStatus: vi.fn().mockResolvedValue({ isAvailable: false, errorCode: 'biometryNotEnrolled' })
    }))

    const mod = await import('./keystore-mobile')
    const bridge = mod.getKeystoreMobileBridge()

    let latest: O.Option<BiometricNotice> = O.none
    const sub = bridge.biometricNotice$.subscribe((v) => {
      latest = v
    })
    const resolved = await bridge.resolveBiometricOptIn(true)
    sub.unsubscribe()

    expect(resolved).toBe(false)
    expect(latest).toEqual(O.some({ reason: 'biometryNotEnrolled', surface: 'onboarding', secureKeyId: 'pending' }))
  })

  it('resolveBiometricOptIn returns true on happy path', async () => {
    vi.doMock('../../../shared/utils/platform', () => ({
      isMobile: true,
      getDeviceInfo: () => ({ isMobile: true })
    }))
    vi.doMock('../../../shared/config/biometric', () => ({
      isBiometricEnabled: () => true
    }))
    vi.doMock('@tauri-apps/plugin-biometric', () => ({
      checkStatus: vi.fn().mockResolvedValue({ isAvailable: true })
    }))

    const mod = await import('./keystore-mobile')
    const bridge = mod.getKeystoreMobileBridge()
    await expect(bridge.resolveBiometricOptIn(true)).resolves.toBe(true)
  })
})
