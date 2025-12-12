import { Keystore } from '@xchainjs/xchain-crypto'

import { KeystoreWallet, KeystoreWallets, isSecureKeystoreWallet, SecureKeystoreWallet } from '../../../shared/api/io'
import { KeystoreId, SecureStorageApi } from '../../../shared/api/types'
import { isBiometricDowngradeError } from '../../../shared/errors/biometric'
import { isError } from '../../../shared/utils/guard'
import { safeStringify } from '../../../shared/utils/safeStringify'
import { recordSecureStorageEvent } from '../app/telemetry'
import { getKeystoreMobileBridge } from './keystore-mobile'
import { runtimeKeystoreCache } from './keystore-runtime-cache'
import {
  createSecureStorageRequiredError,
  createSecureStorageWriteError,
  getSecureStorageFailureReason
} from './secureStorageErrors'

export type StorageMode = 'secure' | 'legacy'

export type NewWalletWriteResult =
  | {
      wallet: SecureKeystoreWallet
      storageMode: 'secure'
      rollback: () => Promise<void>
    }
  | {
      wallet: KeystoreWallet & { keystore: Keystore }
      storageMode: 'legacy'
      rollback?: undefined
    }

const secureStorageBridge = getKeystoreMobileBridge()

export const getSecureStorageApi = (): SecureStorageApi | null => {
  if (typeof window === 'undefined') return null
  if (window.apiKeystore?.secure) return window.apiKeystore.secure
  if (window.apiSecure) return window.apiSecure
  return null
}

const ensureKeystoreFromPayload = (payload: unknown, walletId: KeystoreId): Keystore => {
  if (payload && typeof payload === 'object') {
    const candidate = payload as { type?: unknown; keystore?: unknown }
    if (candidate.type === 'keystore' && candidate.keystore) {
      return candidate.keystore as Keystore
    }
  }
  throw Error(`Secure storage payload for wallet ${walletId} must contain an encrypted keystore`)
}

export const resolveEncryptedKeystoreForWallet = async (wallet: KeystoreWallet): Promise<Keystore> => {
  const cached = runtimeKeystoreCache.get(wallet.id)
  if (cached) return cached

  if (!isSecureKeystoreWallet(wallet)) {
    const legacy = wallet as KeystoreWallet & { keystore: Keystore }
    runtimeKeystoreCache.set(wallet.id, legacy.keystore)
    return legacy.keystore
  }

  const secure = getSecureStorageApi()
  if (!secure) {
    throw Error('Secure keystore storage is not available')
  }

  try {
    const payload = await secure.read(wallet.secureKeyId)
    recordSecureStorageEvent({ action: 'unlock_success', walletId: wallet.id, secureKeyId: wallet.secureKeyId })
    const keystore = ensureKeystoreFromPayload(payload, wallet.id)
    runtimeKeystoreCache.set(wallet.id, keystore)
    return keystore
  } catch (error) {
    if (isBiometricDowngradeError(error)) {
      secureStorageBridge.emitBiometricNotice({
        reason: error.reason,
        surface: 'unlock',
        secureKeyId: error.secureKeyId
      })
      recordSecureStorageEvent({
        action: 'biometric_downgrade_consumed',
        walletId: wallet.id,
        secureKeyId: error.secureKeyId,
        metadata: { reason: error.reason }
      })
      throw error
    }

    const normalized = isError(error) ? error : Error(String(error))
    recordSecureStorageEvent({
      action: 'unlock_failure',
      walletId: wallet.id,
      secureKeyId: wallet.secureKeyId,
      metadata: { message: normalized.message, raw: safeStringify(error) }
    })
    throw normalized
  }
}

export const resolveEncryptedKeystoreById = async (wallets: KeystoreWallets, id: KeystoreId): Promise<Keystore> => {
  const cached = runtimeKeystoreCache.get(id)
  if (cached) return cached

  const wallet = wallets.find((entry) => entry.id === id)
  if (!wallet) {
    throw Error(`Wallet ${id} not found in memory`)
  }

  return resolveEncryptedKeystoreForWallet(wallet)
}

export const writeNewWalletEntry = async (params: {
  id: KeystoreId
  name: string
  keystore: Keystore
  biometricEnabled?: boolean
}): Promise<NewWalletWriteResult> => {
  const secure = getSecureStorageApi()
  if (!secure) {
    return {
      wallet: { id: params.id, name: params.name, keystore: params.keystore, selected: false } as KeystoreWallet & {
        keystore: Keystore
      },
      storageMode: 'legacy'
    }
  }

  const resolvedBiometricEnabled = await secureStorageBridge.resolveBiometricOptIn(params.biometricEnabled === true)

  try {
    const result = await secure.write({
      payload: { type: 'keystore', keystore: params.keystore },
      biometricRequired: resolvedBiometricEnabled
    })

    recordSecureStorageEvent({
      action: 'write_success',
      walletId: params.id,
      secureKeyId: result.secureKeyId,
      metadata: { biometricRequired: String(resolvedBiometricEnabled) }
    })

    const wallet: SecureKeystoreWallet = {
      id: params.id,
      name: params.name,
      selected: false,
      secureKeyId: result.secureKeyId,
      biometricEnabled: resolvedBiometricEnabled,
      lastSecureWriteAt: result.updatedAt,
      lastSecureWriteStatus: 'success',
      exportAcknowledgedAt: null,
      lastExportAction: null,
      lastExportActionAt: null
    }

    return {
      wallet,
      storageMode: 'secure',
      rollback: async () => {
        try {
          await secure.remove(result.secureKeyId)
        } catch (rollbackError) {
          recordSecureStorageEvent({
            action: 'remove_failure',
            walletId: params.id,
            secureKeyId: result.secureKeyId,
            metadata: { message: isError(rollbackError) ? rollbackError.message : safeStringify(rollbackError) }
          })
        }
      }
    }
  } catch (secureError) {
    if (secureStorageBridge.shouldBlockOnSecureFailure()) {
      const error = createSecureStorageRequiredError(secureError)
      recordSecureStorageEvent({
        action: 'onboarding_blocked',
        walletId: params.id,
        metadata: {
          reason: 'secure_storage_required',
          message: error.message,
          platform: 'mobile'
        }
      })
      throw error
    }

    const writeError = createSecureStorageWriteError(secureError)
    const failureReason = getSecureStorageFailureReason(writeError)
    recordSecureStorageEvent({
      action: 'write_failure',
      walletId: params.id,
      metadata: { message: writeError.message, reason: failureReason }
    })

    return {
      wallet: { id: params.id, name: params.name, keystore: params.keystore, selected: false } as KeystoreWallet & {
        keystore: Keystore
      },
      storageMode: 'legacy'
    }
  }
}

export const removeSecureEntryIfNeeded = async (wallet: KeystoreWallet): Promise<void> => {
  if (!isSecureKeystoreWallet(wallet)) return

  const secure = getSecureStorageApi()
  if (!secure) {
    recordSecureStorageEvent({
      action: 'remove_failure',
      walletId: wallet.id,
      secureKeyId: wallet.secureKeyId,
      metadata: { message: 'Secure keystore storage is not available' }
    })
    return
  }

  try {
    await secure.remove(wallet.secureKeyId)
    recordSecureStorageEvent({ action: 'remove', walletId: wallet.id, secureKeyId: wallet.secureKeyId })
  } catch (error) {
    recordSecureStorageEvent({
      action: 'remove_failure',
      walletId: wallet.id,
      secureKeyId: wallet.secureKeyId,
      metadata: { message: isError(error) ? error.message : safeStringify(error) }
    })
  }
}
