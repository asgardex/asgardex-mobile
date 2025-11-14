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
import { mapIOErrors } from '../../shared/utils/fp'
import { isError } from '../../shared/utils/guard'
import { defaultWalletName } from '../../shared/utils/wallet'

const APP_NAME = 'ASGARDEX'
const STORAGE_SUBDIR = 'storage'
const LEGACY_KEYSTORE_ID = 1

let storageDirPromise: Promise<string> | undefined
let deviceTypePromise: Promise<string> | undefined

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

  const { version, payload, createdAt, updatedAt } = parsed as StoredSecurePayload

  if (version !== SECURE_STORAGE_VERSION) {
    throw new Error(
      `Secure storage payload version mismatch (expected ${SECURE_STORAGE_VERSION}, got ${version ?? 'unknown'})`
    )
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Secure storage payload malformed')
  }

  if ((payload as SecureStoragePayload).type !== 'keystore' || !(payload as SecureStoragePayload).keystore) {
    throw new Error('Secure storage payload must contain an encrypted keystore')
  }

  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('Secure storage timestamps missing')
  }

  return {
    version,
    payload: payload as SecureStoragePayload,
    createdAt,
    updatedAt
  }
}

const secureStorageApi: SecureStorageApi = {
  async write({
    secureKeyId,
    payload,
    biometricRequired
  }: SecureStorageWriteParams): Promise<SecureStorageWriteResult> {
    // biometricRequired is accepted for future parity but not acted upon yet
    const key = buildSecureKey(secureKeyId)
    const timestamp = nowIso()
    let createdAt = timestamp

    if (secureKeyId) {
      try {
        const existingRaw = await secureStorage.getItem(key)
        if (existingRaw) {
          const existing = parseStoredSecurePayload(existingRaw)
          createdAt = existing.createdAt
        }
      } catch {
        // Ignore read failures; treat as new entry
      }
    }

    const record: StoredSecurePayload = {
      version: SECURE_STORAGE_VERSION,
      payload,
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

    const parsed = parseStoredSecurePayload(raw)
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

const ensureDeviceType = async (): Promise<string> => {
  if (!deviceTypePromise) {
    deviceTypePromise = invoke<string>('resolve_device_type').catch(() => 'desktop')
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
    const wallets = E.getOrElse<Error, KeystoreWallets>(() => [] as KeystoreWallets)(migrated)
    return writeWalletsToDisk(wallets)
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
