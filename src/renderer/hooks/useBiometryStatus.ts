import { useEffect, useState } from 'react'

import { isBiometricEnabled } from '../../shared/config/biometric'
import { isMobile } from '../../shared/utils/platform'
import { createLogger } from '../services/app/logging'

const logger = createLogger('biometry.status')

export type BiometryStatus = {
  isSupported: boolean
  isChecking: boolean
  error?: string
}

type BiometricModuleStatus = {
  isAvailable?: boolean
  errorCode?: string | null
  biometryNotEnrolled?: boolean
}

const resolveStatusSupport = (status: BiometricModuleStatus | null | undefined): boolean => {
  if (!status) return false
  const isAvailable = status.isAvailable === true
  const hasErrorCode = typeof status.errorCode === 'string' && status.errorCode.length > 0
  const biometryNotEnrolled = status.biometryNotEnrolled === true
  return isAvailable && !hasErrorCode && !biometryNotEnrolled
}

export const useBiometryStatus = (): BiometryStatus => {
  const [isSupported, setIsSupported] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    const safeSetSupported = (value: boolean) => {
      if (!cancelled) {
        setIsSupported(value)
      }
    }
    const safeSetChecking = (value: boolean) => {
      if (!cancelled) {
        setIsChecking(value)
      }
    }
    const safeSetError = (value: string | undefined) => {
      if (!cancelled) {
        setError(value)
      }
    }

    const checkStatus = async () => {
      safeSetChecking(true)
      safeSetError(undefined)

      try {
        if (!isBiometricEnabled()) {
          safeSetSupported(false)
          return
        }

        if (!isMobile) {
          safeSetSupported(false)
          return
        }

        let biometricModule: typeof import('@tauri-apps/plugin-biometric')

        try {
          biometricModule = await import('@tauri-apps/plugin-biometric')
        } catch (importError) {
          void logger.warn('biometric plugin unavailable', { importError })
          safeSetError('plugin_unavailable')
          safeSetSupported(false)
          return
        }

        try {
          const status = (await biometricModule.checkStatus()) as BiometricModuleStatus
          const supported = resolveStatusSupport(status)
          safeSetSupported(supported)
          if (!supported && status?.errorCode) {
            safeSetError(String(status.errorCode))
          }
        } catch (statusError) {
          void logger.warn('failed to check biometric status', { statusError })
          safeSetError(statusError instanceof Error ? statusError.message : String(statusError))
          safeSetSupported(false)
        }
      } catch (unknownError) {
        void logger.error('unexpected biometric status failure', { unknownError })
        safeSetError(unknownError instanceof Error ? unknownError.message : String(unknownError))
        safeSetSupported(false)
      } finally {
        safeSetChecking(false)
      }
    }

    void checkStatus()

    return () => {
      cancelled = true
    }
  }, [])

  return { isSupported, isChecking, error }
}
