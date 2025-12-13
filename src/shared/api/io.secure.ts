/**
 * Tauri-specific io-ts codecs for secure keystore storage.
 * Separated from io.ts to minimize merge conflicts with upstream.
 */
import * as t from 'io-ts'

// Secure write status for tracking biometric storage operations
const secureWriteStatusIO = t.keyof({
  success: null,
  failed: null
})

// Export action tracking for backup flow
const exportActionIO = t.keyof({
  initiated: null,
  completed: null,
  canceled: null
})

const optionalString = t.union([t.string, t.null, t.undefined])
const optionalExportAction = t.union([exportActionIO, t.null, t.undefined])

/**
 * SecureKeystoreWallet codec
 * Used for Tauri mobile builds where the seed phrase is stored
 * in platform secure storage (Keychain/Keystore) with biometric protection.
 */
export const secureKeystoreWalletIO = t.intersection([
  t.type({
    id: t.number,
    name: t.string,
    selected: t.boolean,
    secureKeyId: t.string,
    biometricEnabled: t.boolean,
    lastSecureWriteAt: t.string,
    lastSecureWriteStatus: secureWriteStatusIO
  }),
  t.partial({
    exportAcknowledgedAt: optionalString,
    lastExportAction: optionalExportAction,
    lastExportActionAt: optionalString
  })
])

/**
 * SecureKeystoreWallet type
 * Wallet metadata for secure storage - does not contain the keystore itself,
 * as the seed is stored in platform secure storage referenced by secureKeyId.
 */
export type SecureKeystoreWallet = t.TypeOf<typeof secureKeystoreWalletIO>

/**
 * Type guard to check if a wallet uses secure storage.
 * Works with the KeystoreWallet union type (secure | legacy).
 */
export const isSecureKeystoreWallet = (wallet: unknown): wallet is SecureKeystoreWallet =>
  typeof wallet === 'object' &&
  wallet !== null &&
  'secureKeyId' in wallet &&
  typeof (wallet as Record<string, unknown>).secureKeyId === 'string'
