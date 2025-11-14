import * as RD from '@devexperts/remote-data-ts'
import { Keystore } from '@xchainjs/xchain-crypto'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, readTextFile, writeTextFile, remove, rename } from '@tauri-apps/plugin-fs'
import { join, dirname, appDataDir } from '@tauri-apps/api/path'
import { open as shellOpen } from '@tauri-apps/plugin-shell'
import { invoke } from '@tauri-apps/api/core'
import { either as E, option as O } from 'fp-ts'
import { pipe } from 'fp-ts/function'

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
  StoreFileData,
  StoreFileName,
  type WindowApiSurface
} from '../../shared/api/types'
import {
  IPCKeystoreWallets,
  IPCLedgerAddressesIO,
  KeystoreWallets,
  ipcKeystoreWalletsIO,
  keystoreIO
} from '../../shared/api/io'
import { DEFAULT_STORAGES, INVALID_PATH_SEGMENT, VALID_SEGMENT_PATTERN } from '../../shared/const'
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

const readWalletsFromDisk = async (): Promise<E.Either<Error, KeystoreWallets>> => {
  try {
    const walletsPath = await getWalletsFilePath()
    if (!(await exists(walletsPath))) {
      const empty: IPCKeystoreWallets = []
      return E.right(ipcKeystoreWalletsIO.encode(empty))
    }

    const data = await readJsonFile<unknown>(walletsPath)
    return pipe(
      ipcKeystoreWalletsIO.decode(data),
      E.mapLeft(mapIOErrors),
      E.map((decoded) => ipcKeystoreWalletsIO.encode(decoded))
    )
  } catch (error) {
    return E.left(normalizeError(error))
  }
}

const writeWalletsToDisk = async (wallets: KeystoreWallets): Promise<E.Either<Error, KeystoreWallets>> => {
  try {
    const walletsPath = await getWalletsFilePath()
    await writeJsonFile(walletsPath, wallets)
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

    const wallet: IPCKeystoreWallets = [
      {
        id: LEGACY_KEYSTORE_ID,
        name: defaultWalletName(LEGACY_KEYSTORE_ID),
        selected: true,
        keystore: decoded.right
      }
    ]

    const encoded = ipcKeystoreWalletsIO.encode(wallet)
    const backupPath = await join(await resolveStorageDir(), `keystore-legacy-${Date.now()}.json`)
    await rename(legacyPath, backupPath)
    return E.right(encoded)
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
    const encoded = ipcKeystoreWalletsIO.encode(validated.right)
    return writeWalletsToDisk(encoded)
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
    const wallets = E.getOrElse<Error, KeystoreWallets>(() => ipcKeystoreWalletsIO.encode([]))(migrated)
    return writeWalletsToDisk(wallets)
  }
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
