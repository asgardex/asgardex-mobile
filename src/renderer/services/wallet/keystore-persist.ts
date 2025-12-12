import { either as E } from 'fp-ts'

import { KeystoreWallets } from '../../../shared/api/io'
import { KeystoreId } from '../../../shared/api/types'
import { isError } from '../../../shared/utils/guard'
import { safeStringify } from '../../../shared/utils/safeStringify'
import { createLogger } from '../app/logging'
import { recordSecureStorageEvent } from '../app/telemetry'

const persistLogger = createLogger('wallet-keystore-persist')

type PersistContext = {
  action: string
  walletId?: KeystoreId
  secureKeyId?: string
}

export const persistWalletsOrThrow = async (
  encodedWallets: KeystoreWallets,
  context?: PersistContext,
  rollback?: () => Promise<void>
): Promise<void> => {
  const result = await window.apiKeystore.saveKeystoreWallets(encodedWallets)

  if (E.isRight(result)) return

  const error = result.left
  const message = isError(error) ? error.message : String(error)

  recordSecureStorageEvent({
    action: 'write_persist_failure',
    walletId: context?.walletId,
    secureKeyId: context?.secureKeyId,
    metadata: {
      action: context?.action,
      message
    }
  })

  if (rollback) {
    try {
      await rollback()
    } catch (rollbackError) {
      const rollbackMessage = isError(rollbackError) ? rollbackError.message : safeStringify(rollbackError)
      void persistLogger.warn('Rollback failed after wallet persist failure', {
        action: context?.action,
        error: rollbackMessage
      })
      recordSecureStorageEvent({
        action: 'write_persist_failure',
        walletId: context?.walletId,
        secureKeyId: context?.secureKeyId,
        metadata: {
          action: context?.action,
          rollbackError: rollbackMessage
        }
      })
    }
  }

  throw new Error(`Could not persist wallets${context?.action ? ` (${context.action})` : ''}`)
}
