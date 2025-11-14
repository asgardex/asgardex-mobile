import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SECURE_STORAGE_VERSION } from '../../shared/const'

const {
  invokeMock,
  secureStorageMock,
  biometricModuleMock,
  recordSecureStorageEventMock,
  recordExternalLinkAttemptMock,
  isBiometricEnabledMock,
  joinMock,
  dirnameMock,
  appDataDirMock,
  existsMock,
  mkdirMock
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
  isBiometricEnabledMock: vi.fn(() => true),
  joinMock: vi.fn(),
  dirnameMock: vi.fn(),
  appDataDirMock: vi.fn(),
  existsMock: vi.fn(),
  mkdirMock: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: joinMock,
  dirname: dirnameMock,
  appDataDir: appDataDirMock
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { Document: 'document' },
  exists: existsMock,
  mkdir: mkdirMock,
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn()
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn()
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
  setPlatformDevice: vi.fn()
}))

import { __internalWindowApiHelpers } from './windowApi'

const {
  selectSinglePath,
  ensureJsonExtension,
  secureStorageApi,
  resolveStorageDirForTests,
  resetStorageDirCache,
  resetDeviceTypeCache
} = __internalWindowApiHelpers

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
  joinMock.mockReset()
  joinMock.mockImplementation(async (...segments: string[]) =>
    segments
      .filter((segment) => segment.length > 0)
      .join('/')
      .replace(/\/{2,}/g, '/')
  )
  dirnameMock.mockReset()
  dirnameMock.mockImplementation(async (value: string) => {
    const parts = value.split('/')
    parts.pop()
    return parts.join('/') || '/'
  })
  appDataDirMock.mockReset()
  appDataDirMock.mockResolvedValue('/tmp/appdata')
  existsMock.mockReset()
  existsMock.mockResolvedValue(true)
  mkdirMock.mockReset()
  mkdirMock.mockResolvedValue(undefined)
  resetStorageDirCache()
  resetDeviceTypeCache()
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

describe('storage directory resolution', () => {
  it('keeps storage paths inside appDataDir for mobile builds', async () => {
    invokeMock.mockResolvedValueOnce('mobile')
    appDataDirMock.mockResolvedValue('/data/user/0/org/app')
    existsMock.mockResolvedValue(false)

    const dir = await resolveStorageDirForTests()

    expect(dir).toBe('/data/user/0/org/app/ASGARDEX/storage')
    expect(dirnameMock).not.toHaveBeenCalled()
    expect(mkdirMock).toHaveBeenCalledTimes(2)
  })

  it('walks to the Electron-style parent directory on desktop', async () => {
    invokeMock.mockResolvedValueOnce('desktop')
    appDataDirMock.mockResolvedValue('/Users/dev/Library/Application Support/org.thorchain.asgardex')
    existsMock.mockResolvedValue(false)

    const dir = await resolveStorageDirForTests()

    expect(dirnameMock).toHaveBeenCalledWith('/Users/dev/Library/Application Support/org.thorchain.asgardex')
    expect(dir).toBe('/Users/dev/Library/Application Support/ASGARDEX/storage')
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
