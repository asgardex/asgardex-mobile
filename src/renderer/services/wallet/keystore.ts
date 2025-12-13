import * as RD from '@devexperts/remote-data-ts'
import { decryptFromKeystore, encryptToKeyStore, Keystore } from '@xchainjs/xchain-crypto'
import { delay } from '@xchainjs/xchain-util'
import { function as FP, array as A, either as E, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ipcKeystoreWalletsIO, KeystoreWallets, isSecureKeystoreWallet } from '../../../shared/api/io'
import { KeystoreId } from '../../../shared/api/types'
import { isError } from '../../../shared/utils/guard'
import { isTauri } from '../../../shared/utils/platform'
import { liveData } from '../../helpers/rx/liveData'
import { observableState, triggerStream } from '../../helpers/stateHelper'
import { createLogger } from '../app/logging'
import { INITIAL_KEYSTORE_STATE } from './const'
import type { KeystoreMobileBridge } from './keystore-mobile'
import { persistWalletsOrThrow } from './keystore-persist'
import { runtimeKeystoreCache } from './keystore-runtime-cache'
import {
  removeSecureEntryIfNeeded,
  resolveEncryptedKeystoreById,
  resolveEncryptedKeystoreForWallet,
  writeNewWalletEntry
} from './keystore-storage'
import {
  KeystoreService,
  KeystoreState,
  ValidatePasswordLD,
  LoadKeystoreLD,
  ImportKeystoreParams,
  AddKeystoreParams,
  KeystoreWalletsLD,
  KeystoreWalletsUI$,
  RenameKeystoreWalletHandler,
  ChangeKeystoreWalletHandler,
  isKeystoreUnlocked
} from './types'
import {
  getKeystoreWalletName,
  getKeystoreId,
  hasImportedKeystore,
  getLockedData,
  getInitialKeystoreData
} from './util'

/**
 * State of importing a keystore wallet
 */
const { get$: importingKeystoreState$, set: setImportingKeystoreState } = observableState<
  RD.RemoteData<Error, boolean>
>(RD.initial)

/**
 * State of selected keystore wallet
 */
const {
  get$: keystoreState$,
  get: keystoreState,
  set: setKeystoreState
} = observableState<KeystoreState>(INITIAL_KEYSTORE_STATE)

/**
 * Internal state of keystore wallets - not shared to outside world
 */
const { get$: keystoreWallets$, get: keystoreWallets, set: setKeystoreWallets } = observableState<KeystoreWallets>([])
runtimeKeystoreCache.ensureLifecycleHandlers()

const walletLogger = createLogger('wallet-keystore')

const logWalletInfo = (message: string, context?: Record<string, unknown>) => {
  void walletLogger.info(message, context)
}

const logWalletWarn = (message: string, context?: Record<string, unknown>) => {
  void walletLogger.warn(message, context)
}

const logWalletError = (message: string, context?: Record<string, unknown>) => {
  void walletLogger.error(message, context)
}

const normalizeErrorMessage = (error: unknown): string => {
  const normalized = isError(error) ? error : Error(String(error))
  return normalized.message
}

// ---------------------------------------------------------------------------
// Lazy-loaded Keystore Mobile Bridge
// ---------------------------------------------------------------------------
// The bridge is only loaded in Tauri environments to avoid coupling upstream
// code to Tauri-specific modules at module load time.
// ---------------------------------------------------------------------------

let cachedBridge: KeystoreMobileBridge | null = null
let cachedBridgePromise: Promise<KeystoreMobileBridge | null> | null = null

/**
 * Lazily loads the KeystoreMobileBridge. Returns null in non-Tauri environments.
 * Uses async import() for ESM compatibility in Vite/Tauri WebView.
 */
const getKeystoreMobileBridgeLazy = async (): Promise<KeystoreMobileBridge | null> => {
  if (cachedBridge) return cachedBridge
  if (!isTauri()) return null
  if (cachedBridgePromise) return cachedBridgePromise

  cachedBridgePromise = import('./keystore-mobile')
    .then((mod) => {
      cachedBridge = mod.getKeystoreMobileBridge()
      return cachedBridge
    })
    .catch((error) => {
      logWalletError('Failed to load KeystoreMobileBridge', { error })
      return null
    })

  return cachedBridgePromise
}

// Create proxy observables/functions that delegate to the lazy bridge
// This maintains the same interface while deferring the actual bridge loading

/**
 * Biometric notice observable - delegates to lazy bridge or provides inert fallback
 * In non-Tauri environments, emits O.none once and never emits notices
 */
const biometricNotice$ = new Rx.Observable<O.Option<import('./keystore-mobile').BiometricNotice>>((subscriber) => {
  let innerSub: Rx.Subscription | undefined
  let disposed = false
  void getKeystoreMobileBridgeLazy().then((bridge) => {
    if (disposed) return

    if (bridge) {
      innerSub = bridge.biometricNotice$.subscribe(subscriber)
    } else {
      // Non-Tauri: emit O.none once and complete the observable behavior
      subscriber.next(O.none)
    }
  })
  return () => {
    disposed = true
    innerSub?.unsubscribe()
  }
})

/**
 * Clear biometric notice - delegates to lazy bridge or no-op (fire and forget)
 */
const clearBiometricNotice = (): void => {
  void getKeystoreMobileBridgeLazy().then((bridge) => bridge?.clearBiometricNotice())
}

/**
 * Resolve biometric opt-in - delegates to lazy bridge or returns false
 */
const resolveBiometricOptIn = async (requested: boolean): Promise<boolean> => {
  const bridge = await getKeystoreMobileBridgeLazy()
  return bridge ? bridge.resolveBiometricOptIn(requested) : false
}

/**
 * Adds a keystore and saves it to disk
 */
const addKeystoreWallet = async ({
  phrase,
  name,
  id,
  password,
  biometricEnabled
}: AddKeystoreParams): Promise<void> => {
  try {
    setImportingKeystoreState(RD.pending)
    const keystore: Keystore = await encryptToKeyStore(phrase, password)

    // remove selected state from current wallets
    const wallets = FP.pipe(
      keystoreWallets(),
      A.map((wallet) => ({ ...wallet, selected: false }))
    )
    const {
      wallet: newWallet,
      storageMode,
      rollback
    } = await writeNewWalletEntry({
      id,
      name,
      keystore,
      biometricEnabled
    })

    const updatedWallets: KeystoreWallets = [...wallets, { ...newWallet, selected: true }]

    const encodedWallets = ipcKeystoreWalletsIO.encode(updatedWallets)
    await persistWalletsOrThrow(
      encodedWallets,
      {
        action: 'add_wallet',
        walletId: id,
        secureKeyId: isSecureKeystoreWallet(newWallet) ? newWallet.secureKeyId : undefined
      },
      rollback
    )
    // Update states
    setKeystoreWallets(updatedWallets)
    runtimeKeystoreCache.set(id, keystore)
    setKeystoreState(O.some({ id, phrase, name }))
    setImportingKeystoreState(RD.success(true))
    logWalletInfo('keystore wallet saved', {
      walletId: id,
      name,
      storageMode
    })
    return Promise.resolve()
  } catch (error) {
    logWalletError('failed to add keystore wallet', {
      walletId: id,
      name,
      reason: normalizeErrorMessage(error)
    })
    setImportingKeystoreState(RD.failure(isError(error) ? error : Error('Could not add keystore')))
    return Promise.reject(error)
  }
}

export const removeKeystoreWallet = async () => {
  const state = keystoreState()

  const keystoreId = FP.pipe(state, getKeystoreId, O.toNullable)
  if (!keystoreId) {
    throw Error(`Can't remove wallet - keystore id is missing`)
  }
  // Remove it from `wallets`
  const currentWallets = keystoreWallets()

  const walletToRemove = FP.pipe(
    currentWallets,
    A.findFirst(({ id }) => id === keystoreId),
    O.toNullable
  )

  const wallets = FP.pipe(
    currentWallets,
    A.filter(({ id }) => id !== keystoreId)
  )
  const encodedWallets = ipcKeystoreWalletsIO.encode(wallets)
  await persistWalletsOrThrow(encodedWallets, {
    action: 'remove_wallet',
    walletId: keystoreId,
    secureKeyId: walletToRemove && isSecureKeystoreWallet(walletToRemove) ? walletToRemove.secureKeyId : undefined
  })
  // Update states
  setKeystoreWallets(wallets)
  // Set previous to current wallets (if available)
  const prevWallet = FP.pipe(wallets, A.last)
  setKeystoreState(prevWallet)
  runtimeKeystoreCache.delete(keystoreId)

  if (walletToRemove) {
    await removeSecureEntryIfNeeded(walletToRemove)
  }
  logWalletInfo('keystore wallet removed', {
    walletId: keystoreId,
    remainingWallets: wallets.length
  })

  // return no. of wallets
  return wallets.length
}

const changeKeystoreWallet: ChangeKeystoreWalletHandler = (keystoreId: KeystoreId) => {
  const wallets = keystoreWallets()
  // Get selected wallet
  const selectedWallet = FP.pipe(
    wallets,
    A.findFirst(({ id }) => id === keystoreId),
    O.toNullable
  )

  if (!selectedWallet) return Rx.of(RD.failure(Error(`Could not find a wallet in wallet list with id ${keystoreId}`)))

  const { id, name } = selectedWallet

  const updatedWallets = FP.pipe(
    wallets,
    A.map((wallet) => ({ ...wallet, selected: id === wallet.id }))
  )

  return FP.pipe(
    Rx.from(
      persistWalletsOrThrow(ipcKeystoreWalletsIO.encode(updatedWallets), {
        action: 'change_wallet',
        walletId: id,
        secureKeyId: selectedWallet && isSecureKeystoreWallet(selectedWallet) ? selectedWallet.secureKeyId : undefined
      })
    ),
    RxOp.map(() => {
      setKeystoreWallets(updatedWallets)
      setKeystoreState(O.some({ id, name }))
      logWalletInfo('keystore selection changed', { walletId: id, name })
      return RD.success(true)
    }),
    RxOp.catchError((err) => Rx.of(RD.failure(err))),
    RxOp.startWith(RD.pending)
  )
}

const renameKeystoreWallet: RenameKeystoreWalletHandler = (id, name) => {
  // get keystore state - needs to be UNLOCKED
  const updatedKeystoreState = FP.pipe(
    keystoreState(),
    O.chain(FP.flow(O.fromPredicate(isKeystoreUnlocked))),
    // rename in state
    O.map((state) => ({ ...state, name })),
    O.toNullable
  )

  if (!updatedKeystoreState)
    return Rx.of(RD.failure(Error(`Could not rename wallet with id ${id} - it seems to be locked`)))

  // update selected wallet in list of wallets
  const updatedWallets = FP.pipe(
    keystoreWallets(),
    A.map((wallet) => (id === wallet.id ? { ...wallet, name } : wallet))
  )
  return FP.pipe(
    Rx.from(
      persistWalletsOrThrow(ipcKeystoreWalletsIO.encode(updatedWallets), {
        action: 'rename_wallet',
        walletId: id,
        secureKeyId: (() => {
          const wallet = updatedWallets.find((entry) => entry.id === id)
          return wallet && isSecureKeystoreWallet(wallet) ? wallet.secureKeyId : undefined
        })()
      })
    ),
    RxOp.map(() => RD.success(true)),
    liveData.map(() => {
      setKeystoreWallets(updatedWallets)
      setKeystoreState(O.some(updatedKeystoreState))
      logWalletInfo('keystore renamed', { walletId: id, name })
      return true
    }),
    RxOp.catchError((err) => Rx.of(RD.failure(err))),
    RxOp.startWith(RD.pending)
  )
}

const importKeystore = async ({ keystore, password, name, id }: ImportKeystoreParams): Promise<void> => {
  try {
    setImportingKeystoreState(RD.pending)
    const phrase = await decryptFromKeystore(keystore, password)
    await delay(200)
    return await addKeystoreWallet({ phrase, name, id, password })
  } catch (error) {
    setImportingKeystoreState(RD.failure(isError(error) ? error : Error('Could not add keystore')))
    return Promise.reject(error)
  }
}

/**
 * Exports a keystore
 */
const exportKeystore = async () => {
  try {
    const id = FP.pipe(keystoreState(), getKeystoreId, O.toNullable)
    if (!id) {
      throw Error(`Can't export keystore - keystore id is missing in KeystoreState`)
    }

    const wallets = keystoreWallets()
    const wallet = FP.pipe(
      wallets,
      A.findFirst((entry) => entry.id === id),
      O.toNullable
    )
    if (!wallet) {
      throw Error(`Can't export keystore - wallet is missing in wallet list`)
    }

    const keystore = await resolveEncryptedKeystoreForWallet(wallet)
    const fileName = `asgardex-${FP.pipe(wallets, getKeystoreWalletName(id), O.toNullable) || 'keystore'}.json`
    return await window.apiKeystore.exportKeystore({ fileName, keystore })
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * Loads a keystore into memory
 * using Electron's native file dialog
 */
const loadKeystore$ = (): LoadKeystoreLD => {
  return FP.pipe(
    Rx.from(window.apiKeystore.load()),
    // delay to give UI some time to render
    RxOp.delay(200),
    RxOp.map((keystore) => (keystore ? RD.success(keystore) : RD.initial)), // handle undefined keystore in case when the user click cancel in openDialog
    RxOp.catchError((err) => Rx.of(RD.failure(err))),
    RxOp.startWith(RD.pending)
  )
}

const lock = async () => {
  const state = keystoreState()
  // make sure keystore is already imported
  if (!hasImportedKeystore(state)) {
    throw Error(`Can't lock - keystore seems not to be imported`)
  }

  const lockedState = FP.pipe(getLockedData(state), O.toNullable)
  if (!lockedState) {
    throw Error(`Can't lock - keystore 'id' and / or 'name' are missing`)
  }
  setKeystoreState(O.some(lockedState))
  runtimeKeystoreCache.delete(lockedState.id)
  logWalletInfo('keystore locked', { walletId: lockedState.id, name: lockedState.name })
}

const unlock = async (password: string) => {
  const state = keystoreState()
  const lockedData = FP.pipe(state, getLockedData, O.toNullable)
  // make sure keystore is already imported
  if (!lockedData) {
    throw Error(`Can't unlock - keystore seems not to be imported`)
  }

  const { id, name } = lockedData

  try {
    // decrypt phrase from keystore
    const keystore = await resolveEncryptedKeystoreById(keystoreWallets(), id)
    const phrase = await decryptFromKeystore(keystore, password)
    setKeystoreState(O.some({ id, phrase, name }))
    logWalletInfo('keystore unlocked', { walletId: id, name })
  } catch (error) {
    logWalletWarn('keystore unlock failed', { walletId: id, name, reason: normalizeErrorMessage(error) })
    throw Error(`Can't unlock - could not decrypt phrase from keystore: ${error}`)
  }
}

// `TriggerStream` to reload persistent `KeystoreWallets`
const { stream$: reloadPersistentKeystoreWallets$, trigger: reloadPersistentKeystoreWallets } = triggerStream()

/**
 * Persistent `KeystoreWallets` stored on disc.
 */
const keystoreWalletsPersistent$: KeystoreWalletsLD = FP.pipe(
  reloadPersistentKeystoreWallets$,
  RxOp.switchMap(() => Rx.from(window.apiKeystore.initKeystoreWallets())),
  RxOp.catchError((e) => Rx.of(E.left(e))),
  RxOp.switchMap(
    FP.flow(
      E.fold<Error, KeystoreWallets, KeystoreWalletsLD>(
        (e) => Rx.of(RD.failure(e)),
        (wallets) => Rx.of(RD.success(wallets))
      )
    )
  ),
  RxOp.startWith(RD.pending),
  RxOp.shareReplay(1)
)

// Subscribe keystoreWalletsPersistent$
// to update internal `KeystoreWallets` + `KeystoreState` stored in memory
// whenever data are loaded from disc,
keystoreWalletsPersistent$.subscribe((walletsRD) =>
  FP.pipe(
    walletsRD,
    RD.map((wallets) => {
      const state = getInitialKeystoreData(wallets)
      // update internal `KeystoreWallets` + `KeystoreState` stored in memory
      setKeystoreState(state)
      setKeystoreWallets(wallets)
      const allowed = new Set(wallets.map(({ id }) => id))
      runtimeKeystoreCache.prune(allowed)
      return true
    })
  )
)

// Simplified `KeystoreWallets` (w/o loading state, w/o `keystore`) to display data at UIs
const keystoreWalletsUI$: KeystoreWalletsUI$ = FP.pipe(
  keystoreWallets$,
  // Transform `KeystoreWallets` -> `KeystoreWalletsUI`
  RxOp.map(FP.flow(A.map(({ id, name, selected }) => ({ id, name, selected })))),
  RxOp.shareReplay(1)
)

const validatePassword$ = (password: string): ValidatePasswordLD =>
  password
    ? FP.pipe(
        FP.pipe(keystoreState(), getKeystoreId, O.toNullable),
        (id) => {
          if (!id) {
            return Rx.of(RD.failure(Error('Could not get current keystore to validate password')))
          }
          return FP.pipe(
            Rx.from(resolveEncryptedKeystoreById(keystoreWallets(), id)),
            RxOp.switchMap((keystore) => Rx.from(decryptFromKeystore(keystore, password))),
            // // don't store phrase in result
            RxOp.map((_ /* phrase */) => RD.success(undefined)),
            RxOp.catchError((err) => Rx.of(RD.failure(err)))
          )
        },
        RxOp.startWith(RD.pending)
      )
    : Rx.of(RD.initial)

export const keystoreService: KeystoreService = {
  keystoreState$,
  keystoreState,
  addKeystoreWallet,
  removeKeystoreWallet,
  changeKeystoreWallet,
  renameKeystoreWallet,
  importKeystore,
  exportKeystore,
  loadKeystore$,
  lock,
  unlock,
  validatePassword$,
  keystoreWalletsPersistent$,
  reloadPersistentKeystoreWallets,
  keystoreWalletsUI$,
  importingKeystoreState$,
  resetImportingKeystoreState: () => setImportingKeystoreState(RD.initial)
}

export const __internalKeystoreBiometric = {
  biometricNotice$,
  clearBiometricNotice,
  resolveBiometricOptIn
}
