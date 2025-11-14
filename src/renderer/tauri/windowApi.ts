import * as RD from '@devexperts/remote-data-ts'
import { invoke } from '@tauri-apps/api/core'
import { join, dirname, appDataDir } from '@tauri-apps/api/path'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, readTextFile, writeTextFile, remove, rename } from '@tauri-apps/plugin-fs'
import { open as shellOpen } from '@tauri-apps/plugin-shell'
import { Keystore } from '@xchainjs/xchain-crypto'
import { either as E, option as O } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { secureStorage } from 'tauri-plugin-secure-storage'
import { v4 as uuidv4 } from 'uuid'

import { IPCKeystoreWallets, KeystoreWallets, ipcKeystoreWalletsIO, keystoreIO } from '../../shared/api/io'
import {
  ApiAppUpdate,
  ApiFileStoreService,
  ApiHDWallet,
  ApiKeystore,
  ApiLang,
  ApiUrl,
  AppUpdateRD,
  LedgerError,
  LedgerErrorId,
  SecureStorageApi,
  SecureStorageExistResult,
  SecureStoragePayload,
  SecureStorageWriteParams,
  SecureStorageWriteResult,
  StoreFileData,
  StoreFileName,
  type WindowApiSurface
} from '../../shared/api/types'
import {
  DEFAULT_STORAGES,
  INVALID_PATH_SEGMENT,
  SECURE_KEY_PREFIX,
  SECURE_STORAGE_VERSION,
  VALID_SEGMENT_PATTERN
} from '../../shared/const'
import { isBiometricEnabled, DEFAULT_BIOMETRIC_PROMPT } from '../../shared/config/biometric'
import { BiometricDowngradeReason } from '../../shared/errors/biometric'
import { mapIOErrors } from '../../shared/utils/fp'
import { isError } from '../../shared/utils/guard'
import { safeStringify } from '../../shared/utils/safeStringify'
import { createSecureStorageVersionMismatchError } from '../services/wallet/secureStorageErrors'
import { recordSecureStorageEvent } from '../services/app/telemetry'
import { setPlatformDevice } from '../../shared/utils/platform'
import { defaultWalletName } from '../../shared/utils/wallet'

const APP_NAME = 'ASGARDEX'
const STORAGE_SUBDIR = 'storage'
const LEGACY_KEYSTORE_ID = 1

let storageDirPromise: Promise<string> | undefined
let deviceTypePromise: Promise<'mobile' | 'desktop' | 'unknown'> | undefined

const normalizeError = (error: unknown): Error => (isError(error) ? error : new Error(String(error)))

const ensureDir = async (path: string) => {
  const alreadyExists = await exists(path)
  if (!alreadyExists) {
    await mkdir(path, { recursive: true })
  }
}

const resolveStorageDir = (): Promise<string> => {
  if (!storageDirPromise) {
    storageDirPromise = (async () => {
      const tauriAppData = await appDataDir()
      const parentDir = await dirname(tauriAppData)
      const electronLikeAppDir = await join(parentDir, APP_NAME)
      await ensureDir(electronLikeAppDir)
      const storageDir = await join(electronLikeAppDir, STORAGE_SUBDIR)
      await ensureDir(storageDir)
      return storageDir
    })()
  }
  return storageDirPromise
}

const sanitizeSegment = (segment: string, label: string): string => {
  if (INVALID_PATH_SEGMENT.test(segment) || !VALID_SEGMENT_PATTERN.test(segment)) {
    throw new Error(`Invalid path segment for ${label}: "${segment}"`)
  }
  return segment
}

const buildJsonFilePath = async (name: string, version: string): Promise<string> => {
  const storageDir = await resolveStorageDir()
  const safeName = sanitizeSegment(name, 'file name')
  const safeVersion = sanitizeSegment(version, 'version')
  return join(storageDir, `${safeName}-${safeVersion}.json`)
}

const readJsonFile = async <T>(path: string): Promise<T> => {
  const content = await readTextFile(path)
  return JSON.parse(content) as T
}

const writeJsonFile = async (path: string, data: unknown) => {
  const dir = await dirname(path)
  await ensureDir(dir)
  await writeTextFile(path, JSON.stringify(data, null, 2))
}

const getWalletsFilePath = async (): Promise<string> => {
  const storageDir = await resolveStorageDir()
  return join(storageDir, 'wallets.json')
}

const getLegacyKeystoreFilePath = async (): Promise<string> => {
  const storageDir = await resolveStorageDir()
  return join(storageDir, 'keystore.json')
}

type StoredSecurePayload = {
  version: number
  payload: SecureStoragePayload
  biometricRequired: boolean
  createdAt: string
  updatedAt: string
}

const nowIso = () => new Date().toISOString()

const buildSecureKey = (secureKeyId?: string) => secureKeyId ?? `${SECURE_KEY_PREFIX}-${uuidv4()}`

const parseStoredSecurePayload = (raw: string): StoredSecurePayload => {
  const parsed = JSON.parse(raw) as Partial<StoredSecurePayload> | undefined
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Secure storage payload missing')
  }

  const candidate = parsed as Partial<StoredSecurePayload> & { version?: unknown }
  const versionValue = candidate.version
  const actualVersion = typeof versionValue === 'number' ? versionValue : null

  if (actualVersion !== SECURE_STORAGE_VERSION) {
    throw createSecureStorageVersionMismatchError(SECURE_STORAGE_VERSION, actualVersion)
  }

  const payload = candidate.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Secure storage payload malformed')
  }

  if ((payload as SecureStoragePayload).type !== 'keystore' || !(payload as SecureStoragePayload).keystore) {
    throw new Error('Secure storage payload must contain an encrypted keystore')
  }

  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined
  if (!createdAt || !updatedAt) {
    throw new Error('Secure storage timestamps missing')
  }

  const biometricRequired = typeof candidate.biometricRequired === 'boolean' ? candidate.biometricRequired : false

  return {
    version: SECURE_STORAGE_VERSION,
    payload: payload as SecureStoragePayload,
    biometricRequired,
    createdAt,
    updatedAt
  }
}

const toErrorMessage = (value: unknown): string => {
  if (isError(value)) return value.message
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value && typeof value === 'object') {
    const serialized = safeStringify(value)
    if (serialized !== '[unserializable]') return serialized
  }
  return String(value)
}

const normalizeUnknownError = (error: unknown): Error => {
  if (isError(error)) return error
  const normalized = new Error(toErrorMessage(error))
  if (error && typeof error === 'object') {
    ;(normalized as Error & { cause?: unknown }).cause = error
  }
  return normalized
}

const BIOMETRIC_ENROLLMENT_ERROR_CODES = new Set<BiometricDowngradeReason>([
  'biometryNotEnrolled',
  'passcodeNotSet',
  'biometryNotAvailable'
])

type BiometricStatusLike = {
  isAvailable?: boolean
  errorCode?: string | null
}

const resolveDowngradeReasonFromStatus = (status: BiometricStatusLike): BiometricDowngradeReason | null => {
  const code = status?.errorCode ?? null
  if (!status?.isAvailable || (code && BIOMETRIC_ENROLLMENT_ERROR_CODES.has(code as BiometricDowngradeReason))) {
    if (code && BIOMETRIC_ENROLLMENT_ERROR_CODES.has(code as BiometricDowngradeReason)) {
      return code as BiometricDowngradeReason
    }
    return 'biometryNotAvailable'
  }
  return null
}

const secureStorageApi: SecureStorageApi = {
  async write({
    secureKeyId,
    payload,
    biometricRequired
  }: SecureStorageWriteParams): Promise<SecureStorageWriteResult> {
    const key = buildSecureKey(secureKeyId)
    const timestamp = nowIso()
    let createdAt = timestamp
    let resolvedBiometric = biometricRequired ?? false

    if (secureKeyId) {
      try {
        const existingRaw = await secureStorage.getItem(key)
        if (existingRaw) {
          const existing = parseStoredSecurePayload(existingRaw)
          createdAt = existing.createdAt
          resolvedBiometric = biometricRequired ?? existing.biometricRequired
        }
      } catch (error) {
        // Ignore parse errors here (including version mismatch); callers will handle them on read.
        const message = isError(error) ? error.message : String(error)
        console.warn(`[tauri-windowApi] Failed to read existing secure entry ${key}: ${message}`)
      }
    }

    const record: StoredSecurePayload = {
      version: SECURE_STORAGE_VERSION,
      payload,
      biometricRequired: resolvedBiometric,
      createdAt,
      updatedAt: timestamp
    }

    await secureStorage.setItem(key, JSON.stringify(record))
    return { secureKeyId: key, updatedAt: record.updatedAt }
  },

  async read(secureKeyId: string): Promise<SecureStoragePayload> {
    const raw = await secureStorage.getItem(secureKeyId)
    if (!raw) {
      throw new Error(`Secure storage entry ${secureKeyId} not found`)
    }

    let parsed: StoredSecurePayload
    try {
      parsed = parseStoredSecurePayload(raw)
    } catch (error) {
      // Surface version mismatch and other parse errors to the caller; keystore
      // service will emit dedicated telemetry for version mismatches.
      throw error
    }

    const deviceType = await ensureDeviceType()
    if (deviceType === 'mobile' && isBiometricEnabled() && parsed.biometricRequired) {
      let biometricModule: typeof import('@tauri-apps/plugin-biometric') | undefined

      try {
        biometricModule = await import('@tauri-apps/plugin-biometric')
      } catch (importError) {
        const metadata: Record<string, string> = {
          reason: 'pluginUnavailable',
          message: toErrorMessage(importError)
        }
        recordSecureStorageEvent({
          action: 'biometric_failure',
          secureKeyId,
          metadata
        })
        throw normalizeUnknownError(importError)
      }

      try {
        const { checkStatus, authenticate } = biometricModule!
        let status: BiometricStatusLike | undefined
        try {
          status = await checkStatus()
        } catch (statusError) {
          const metadata: Record<string, string> = {
            reason: 'statusError',
            message: toErrorMessage(statusError)
          }
          recordSecureStorageEvent({
            action: 'biometric_failure',
            secureKeyId,
            metadata
          })
          throw normalizeUnknownError(statusError)
        }

        const downgradeReason = resolveDowngradeReasonFromStatus(status ?? {})
        if (downgradeReason) {
          const metadata: Record<string, string> = {
            reason: downgradeReason
          }
          if (status?.errorCode) {
            metadata.statusError = status.errorCode
          }
          recordSecureStorageEvent({
            action: 'biometric_failure',
            secureKeyId,
            metadata
          })
          throw new Error('Biometric authentication is required but not available on this device.')
        }

        await authenticate(DEFAULT_BIOMETRIC_PROMPT)
        recordSecureStorageEvent({ action: 'biometric_success', secureKeyId })
      } catch (error) {
        const normalized = normalizeUnknownError(error)
        const metadata: Record<string, string> = {
          errorName: normalized.name || 'Error',
          errorMessage: normalized.message
        }
        const rawError = toErrorMessage(error)
        if (rawError && rawError !== normalized.message) {
          metadata.raw = rawError
        }
        recordSecureStorageEvent({
          action: 'biometric_failure',
          secureKeyId,
          metadata
        })

        throw normalized
      }
    }

    return parsed.payload
  },

  async remove(secureKeyId: string): Promise<void> {
    try {
      await secureStorage.removeItem(secureKeyId)
    } catch (error) {
      throw normalizeError(error)
    }
  },

  async exists(secureKeyId: string): Promise<SecureStorageExistResult> {
    try {
      const raw = await secureStorage.getItem(secureKeyId)
      return { exists: raw !== null, supported: true }
    } catch (error) {
      const message = isError(error) ? error.message : String(error)
      if (/No command/i.test(message) && /secure-storage/i.test(message)) {
        return { exists: false, supported: false }
      }
      throw normalizeError(error)
    }
  },

  async list(): Promise<string[]> {
    try {
      const keys = await secureStorage.keys()
      return keys.filter((key) => key.startsWith(SECURE_KEY_PREFIX))
    } catch (error) {
      const message = isError(error) ? error.message : String(error)
      if (/No command/i.test(message) && /secure-storage/i.test(message)) {
        // Plugin not available; report as empty list but supported=false via exists()
        return []
      }
      throw normalizeError(error)
    }
  }
}

const readWalletsFromDisk = async (): Promise<E.Either<Error, KeystoreWallets>> => {
  try {
    const walletsPath = await getWalletsFilePath()
    if (!(await exists(walletsPath))) {
      const empty: IPCKeystoreWallets = []
      return pipe(ipcKeystoreWalletsIO.decode(empty), E.mapLeft(mapIOErrors))
    }

    const data = await readJsonFile<unknown>(walletsPath)
    return pipe(ipcKeystoreWalletsIO.decode(data), E.mapLeft(mapIOErrors))
  } catch (error) {
    return E.left(normalizeError(error))
  }
}

const writeWalletsToDisk = async (wallets: KeystoreWallets): Promise<E.Either<Error, KeystoreWallets>> => {
  try {
    const walletsPath = await getWalletsFilePath()
    const encoded = ipcKeystoreWalletsIO.encode(wallets)
    await writeJsonFile(walletsPath, encoded)
    return E.right(wallets)
  } catch (error) {
    return E.left(normalizeError(error))
  }
}

const migrateLegacyWallet = async (): Promise<E.Either<Error, KeystoreWallets>> => {
  try {
    const legacyPath = await getLegacyKeystoreFilePath()
    if (!(await exists(legacyPath))) {
      throw new Error(`${legacyPath} file does not exist`)
    }

    const legacyData = await readJsonFile<unknown>(legacyPath)
    const decoded = pipe(keystoreIO.decode(legacyData), E.mapLeft(mapIOErrors))
    if (E.isLeft(decoded)) return decoded

    const wallets: KeystoreWallets = [
      {
        id: LEGACY_KEYSTORE_ID,
        name: defaultWalletName(LEGACY_KEYSTORE_ID),
        selected: true,
        keystore: decoded.right
      }
    ]

    const backupPath = await join(await resolveStorageDir(), `keystore-legacy-${Date.now()}.json`)
    await rename(legacyPath, backupPath)
    return E.right(wallets)
  } catch (error) {
    return E.left(normalizeError(error))
  }
}

const ensureDeviceType = async (): Promise<'mobile' | 'desktop' | 'unknown'> => {
  if (!deviceTypePromise) {
    deviceTypePromise = invoke<'mobile' | 'desktop' | 'unknown'>('resolve_device_type')
      .then((classification) => {
        if (classification === 'mobile' || classification === 'desktop') {
          setPlatformDevice({
            type: classification,
            isMobile: classification === 'mobile',
            source: 'platform'
          })
          return classification
        }
        return 'unknown'
      })
      .catch(() => 'unknown')
  }
  return deviceTypePromise
}

const ledgerUnavailableMessage = async (): Promise<string> => {
  const deviceType = await ensureDeviceType()
  return deviceType !== 'desktop'
    ? 'Ledger is disabled on mobile builds.'
    : 'Ledger support is not available in the Tauri build yet.'
}

const ledgerNotAvailable = async <T>(): Promise<E.Either<LedgerError, T>> => {
  const msg = await ledgerUnavailableMessage()
  return E.left({ errorId: LedgerErrorId.NOT_IMPLEMENTED, msg })
}

const ledgerStorageNotAvailable = async <T>(): Promise<E.Either<Error, T>> => {
  const msg = await ledgerUnavailableMessage()
  return E.left(new Error(msg))
}

const createFileStoreApi = <FileName extends StoreFileName>(
  name: FileName,
  defaultValue: StoreFileData<FileName>
): ApiFileStoreService<StoreFileData<FileName>> => {
  const resolveFilePath = async () => buildJsonFilePath(name, defaultValue.version)

  const readContent = async (): Promise<StoreFileData<FileName>> => {
    try {
      const path = await resolveFilePath()
      if (!(await exists(path))) {
        await writeJsonFile(path, defaultValue)
        return defaultValue
      }
      const data = await readJsonFile<StoreFileData<FileName>>(path)
      return { ...defaultValue, ...data }
    } catch {
      return defaultValue
    }
  }

  return {
    save: async (data) => {
      const path = await resolveFilePath()
      const current = await readContent()
      const next = { ...current, ...data }
      await writeJsonFile(path, next)
      return next
    },
    remove: async () => {
      const path = await resolveFilePath()
      if (await exists(path)) {
        await remove(path)
      }
    },
    get: async () => readContent(),
    exists: async () => exists(await resolveFilePath())
  }
}

const apiKeystore: ApiKeystore = {
  saveKeystoreWallets: async (wallets) => {
    const validated = pipe(ipcKeystoreWalletsIO.decode(wallets), E.mapLeft(mapIOErrors))
    if (E.isLeft(validated)) return E.left(validated.left)
    return writeWalletsToDisk(validated.right)
  },
  exportKeystore: async ({ fileName, keystore }) => {
    const target = await saveDialog({ defaultPath: fileName })
    if (!target) return
    await writeJsonFile(target, keystore)
  },
  load: async () => {
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: 'Keystore', extensions: ['json'] }]
    })
    if (!selected) {
      // Electron preload returns `undefined` when the dialog is cancelled; preserve behavior for parity
      return undefined as unknown as Keystore
    }
    const filePath = Array.isArray(selected) ? selected[0] : selected
    const data = await readJsonFile<unknown>(filePath)
    const decoded = pipe(keystoreIO.decode(data), E.mapLeft(mapIOErrors))
    if (E.isLeft(decoded)) {
      throw decoded.left
    }
    return decoded.right
  },
  initKeystoreWallets: async () => {
    const loaded = await readWalletsFromDisk()
    if (E.isLeft(loaded)) return loaded
    if (loaded.right.length) return loaded

    const migrated = await migrateLegacyWallet()
    if (E.isLeft(migrated)) {
      const error = migrated.left
      const message = error.message ?? ''
      // If the legacy file is missing, treat it as "no wallets yet" and
      // initialize an empty wallets list. For any other failure, propagate
      // the error so the renderer can surface it instead of silently
      // overwriting storage with an empty list.
      if (!/file does not exist/i.test(message)) {
        return E.left(error)
      }
      return writeWalletsToDisk([] as KeystoreWallets)
    }

    return writeWalletsToDisk(migrated.right)
  },
  secure: secureStorageApi
}

const apiLang: ApiLang = {
  update: () => {}
}

const apiUrl: ApiUrl = {
  openExternal: (url: string) => shellOpen(url)
}

const apiHDWallet: ApiHDWallet = {
  getLedgerAddress: async () => ledgerNotAvailable(),
  verifyLedgerAddress: async () => {
    throw new Error(await ledgerUnavailableMessage())
  },
  sendLedgerTx: async () => ledgerNotAvailable(),
  depositLedgerTx: async () => ledgerNotAvailable(),
  approveLedgerERC20Token: async () => ledgerNotAvailable(),
  saveLedgerAddresses: async () => ledgerStorageNotAvailable(),
  getLedgerAddresses: async () => ledgerStorageNotAvailable()
}

const apiCommonStorage = createFileStoreApi('common', DEFAULT_STORAGES.common)
const apiUserNodesStorage = createFileStoreApi('userNodes', DEFAULT_STORAGES.userNodes)
const apiUserBondProvidersStorage = createFileStoreApi('userBondProviders', DEFAULT_STORAGES.userBondProviders)
const apiChainStorage = createFileStoreApi('userChains', DEFAULT_STORAGES.userChains)
const apiAddressStorage = createFileStoreApi('userAddresses', DEFAULT_STORAGES.userAddresses)
const apiAssetStorage = createFileStoreApi('userAssets', DEFAULT_STORAGES.userAssets)
const apiPoolsStorage = createFileStoreApi('pools', DEFAULT_STORAGES.pools)

const apiAppUpdate: ApiAppUpdate = {
  checkForAppUpdates: async (): Promise<AppUpdateRD> => RD.success(O.none)
}

const windowApiSurface = {
  apiKeystore,
  apiSecure: apiKeystore.secure ?? secureStorageApi,
  apiLang,
  apiUrl,
  apiHDWallet,
  apiCommonStorage,
  apiUserNodesStorage,
  apiUserBondProvidersStorage,
  apiChainStorage,
  apiAddressStorage,
  apiAssetStorage,
  apiPoolsStorage,
  apiAppUpdate
} satisfies WindowApiSurface

if (typeof window !== 'undefined') {
  Object.assign(window, windowApiSurface)
}

export {}
