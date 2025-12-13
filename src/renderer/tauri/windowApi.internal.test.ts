import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SECURE_STORAGE_VERSION } from '../../shared/const'

const {
  invokeMock,
  secureStorageMock,
  biometricModuleMock,
  recordSecureStorageEventMock,
  recordExternalLinkAttemptMock,
  isBiometricEnabledMock
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  secureStorageMock: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    keys: vi.fn(),
    removeItem: vi.fn()
  },
  biometricModuleMock: {
    checkStatus: vi.fn(),
    authenticate: vi.fn()
  },
  recordSecureStorageEventMock: vi.fn(),
  recordExternalLinkAttemptMock: vi.fn(),
  isBiometricEnabledMock: vi.fn(() => true)
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(),
  dirname: vi.fn(),
  appDataDir: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { Document: 'document' },
  exists: vi.fn(),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn()
}))

vi.mock('tauri-plugin-secure-storage', () => ({
  secureStorage: secureStorageMock
}))

vi.mock('@tauri-apps/plugin-biometric', () => biometricModuleMock)

vi.mock('../services/app/telemetry', () => ({
  recordSecureStorageEvent: recordSecureStorageEventMock,
  recordExternalLinkAttempt: recordExternalLinkAttemptMock
}))

vi.mock('../services/app/logging', () => ({
  createLogger: () => ({
    warn: vi.fn(() => Promise.resolve()),
    error: vi.fn(() => Promise.resolve())
  })
}))

vi.mock('../../shared/config/biometric', () => ({
  isBiometricEnabled: isBiometricEnabledMock,
  DEFAULT_BIOMETRIC_PROMPT: 'Authenticate to access your ASGARDEX wallet'
}))

vi.mock('../../shared/utils/platform', () => ({
  setPlatformDevice: vi.fn(),
  isTauri: vi.fn(() => false)
}))

import { __internalWindowApiHelpers } from './windowApi'

const { selectSinglePath, ensureJsonExtension, secureStorageApi } = __internalWindowApiHelpers

const resetSecureStorageMocks = () => {
  secureStorageMock.setItem.mockReset()
  secureStorageMock.getItem.mockReset()
  secureStorageMock.keys.mockReset()
  secureStorageMock.removeItem.mockReset()
}

beforeEach(() => {
  vi.clearAllMocks()
  resetSecureStorageMocks()
  invokeMock.mockReset()
  biometricModuleMock.checkStatus.mockReset()
  biometricModuleMock.authenticate.mockReset()
  recordSecureStorageEventMock.mockReset()
  recordExternalLinkAttemptMock.mockReset()
  isBiometricEnabledMock.mockReturnValue(true)
})

describe('windowApi internal helpers', () => {
  describe('selectSinglePath', () => {
    it('returns first entry from array selection', () => {
      expect(selectSinglePath(['a', 'b'])).toBe('a')
      expect(selectSinglePath([])).toBeNull()
    })

    it('returns path from object selection', () => {
      expect(selectSinglePath({ path: '/tmp/file.json' })).toBe('/tmp/file.json')
      expect(selectSinglePath({ filePath: '/tmp/other.json' })).toBe('/tmp/other.json')
      expect(selectSinglePath({ uri: '/tmp/from-uri.json' })).toBe('/tmp/from-uri.json')
    })

    it('returns string selection as-is', () => {
      expect(selectSinglePath('/tmp/single.json')).toBe('/tmp/single.json')
    })

    it('returns null for null/unknown selection', () => {
      expect(selectSinglePath(null)).toBeNull()
      expect(selectSinglePath({})).toBeNull()
    })
  })

  describe('ensureJsonExtension', () => {
    it('keeps .json extension if already present (case-insensitive)', () => {
      expect(ensureJsonExtension('file.json')).toBe('file.json')
      expect(ensureJsonExtension('FILE.JSON')).toBe('FILE.JSON')
    })

    it('appends .json when missing', () => {
      expect(ensureJsonExtension('file')).toBe('file.json')
      expect(ensureJsonExtension('/tmp/file')).toBe('/tmp/file.json')
    })
  })
})

describe('secureStorageApi', () => {
  it('reports secure storage unsupported when plugin commands are missing', async () => {
    secureStorageMock.keys.mockRejectedValue(new Error('No command secure-storage'))

    const result = await secureStorageApi.exists('secure-entry')

    expect(result).toEqual({ exists: false, supported: false })
  })

  it('records telemetry when biometric status indicates downgrade', async () => {
    const storedPayload = {
      version: SECURE_STORAGE_VERSION,
      payload: { type: 'keystore', keystore: { version: '1.0.0', crypto: {} } },
      biometricRequired: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    }
    secureStorageMock.getItem.mockResolvedValue(JSON.stringify(storedPayload))
    invokeMock.mockResolvedValueOnce('mobile')
    biometricModuleMock.checkStatus.mockResolvedValue({
      isAvailable: false,
      errorCode: 'biometryNotEnrolled'
    })

    await expect(secureStorageApi.read('secure-entry')).rejects.toThrow(/Biometric authentication is required/)

    expect(recordSecureStorageEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'biometric_failure',
        secureKeyId: 'secure-entry',
        metadata: expect.objectContaining({ reason: 'biometryNotEnrolled' })
      })
    )
  })
})
