import { option as O } from 'fp-ts'

import { isBiometricEnabled } from '../../../shared/config/biometric'
import { BiometricDowngradeReason } from '../../../shared/errors/biometric'
import { getDeviceInfo, isMobile } from '../../../shared/utils/platform'
import { observableState } from '../../helpers/stateHelper'

const SECURE_STORAGE_ENV_KEY = 'VITE_TAURI_SECURE_STORAGE_ENABLED'

type TestImportMetaEnvContainer = {
  __TAURI_TEST_IMPORT_META_ENV__?: Record<string, unknown>
}

const getTestImportMetaEnv = (): Record<string, unknown> | undefined => {
  const container = globalThis as TestImportMetaEnvContainer
  return container.__TAURI_TEST_IMPORT_META_ENV__
}

const normalizeSecureStorageFlag = (value: unknown): boolean | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return null
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return null
}

const readSecureStorageFlagFromImportMeta = (): unknown => {
  const testEnv = getTestImportMetaEnv()
  if (testEnv && SECURE_STORAGE_ENV_KEY in testEnv) {
    return testEnv[SECURE_STORAGE_ENV_KEY]
  }

  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> } | undefined)?.env
    if (metaEnv && SECURE_STORAGE_ENV_KEY in metaEnv) {
      return metaEnv[SECURE_STORAGE_ENV_KEY]
    }
  } catch {
    // ignore: import.meta can be undefined in Node/Vitest contexts
  }

  return undefined
}

const readSecureStorageFlagFromProcessEnv = (): unknown => {
  if (typeof process === 'undefined') return undefined
  return process.env?.[SECURE_STORAGE_ENV_KEY]
}

const isProductionEnvironment = (): boolean => {
  const testEnv = getTestImportMetaEnv()
  if (testEnv) {
    const prodValue = testEnv.PROD
    if (typeof prodValue === 'boolean') return prodValue
    if (typeof prodValue === 'string') {
      const normalized = prodValue.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }

    const modeValue = testEnv.MODE
    if (typeof modeValue === 'string') {
      const normalizedMode = modeValue.trim().toLowerCase()
      if (normalizedMode) {
        return normalizedMode === 'production'
      }
    }
  }

  try {
    const metaEnv = (import.meta as unknown as { env?: { MODE?: string; PROD?: boolean } } | undefined)?.env
    if (metaEnv) {
      if (typeof metaEnv.PROD === 'boolean') return metaEnv.PROD
      const modeValue = metaEnv.MODE
      if (typeof modeValue === 'string') {
        const normalized = modeValue.trim().toLowerCase()
        if (normalized) {
          return normalized === 'production'
        }
      }
    }
  } catch {
    // ignore: import.meta is unavailable in some contexts
  }

  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
    return process.env.NODE_ENV.trim().toLowerCase() === 'production'
  }

  return false
}

const resolveSecureStorageDefault = (): boolean => {
  if (!isProductionEnvironment()) return false
  try {
    return getDeviceInfo().isMobile
  } catch {
    return false
  }
}

const isSecureStorageFlagEnabled = (): boolean => {
  const sources: Array<() => unknown> = [readSecureStorageFlagFromImportMeta, readSecureStorageFlagFromProcessEnv]
  for (const getValue of sources) {
    const normalized = normalizeSecureStorageFlag(getValue())
    if (normalized !== null) {
      return normalized
    }
  }
  return resolveSecureStorageDefault()
}

const BIOMETRIC_ENROLLMENT_ERROR_CODES = new Set<BiometricDowngradeReason>([
  'biometryNotEnrolled',
  'passcodeNotSet',
  'biometryNotAvailable'
])

export const shouldBlockOnSecureFailure = (): boolean => {
  if (!isSecureStorageFlagEnabled()) return false
  const deviceInfo = getDeviceInfo()
  if (typeof deviceInfo.isMobile === 'boolean') {
    return deviceInfo.isMobile
  }
  return isMobile
}

export type BiometricNoticeSurface = 'onboarding' | 'unlock'

export type BiometricNotice = {
  reason: BiometricDowngradeReason
  surface: BiometricNoticeSurface
  secureKeyId: string
}

const { get$: biometricNotice$, set: setBiometricNotice } = observableState<O.Option<BiometricNotice>>(O.none)
const emitBiometricNotice = (notice: BiometricNotice) => setBiometricNotice(O.some(notice))
const clearBiometricNotice = () => setBiometricNotice(O.none)

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

const resolveBiometricOptIn = async (requested: boolean): Promise<boolean> => {
  if (!requested) return false
  if (!isBiometricEnabled() || !isMobile) return false

  let biometricModule: typeof import('@tauri-apps/plugin-biometric') | undefined
  try {
    biometricModule = await import('@tauri-apps/plugin-biometric')
  } catch {
    emitBiometricNotice({ reason: 'pluginUnavailable', surface: 'onboarding', secureKeyId: 'pending' })
    return false
  }

  try {
    const status = await biometricModule.checkStatus()
    const downgradeReason = resolveDowngradeReasonFromStatus(status ?? {})
    if (downgradeReason) {
      emitBiometricNotice({
        reason: downgradeReason,
        surface: 'onboarding',
        secureKeyId: 'pending'
      })
      return false
    }
  } catch {
    emitBiometricNotice({ reason: 'statusError', surface: 'onboarding', secureKeyId: 'pending' })
    return false
  }

  return true
}

export type KeystoreMobileBridge = {
  biometricNotice$: typeof biometricNotice$
  clearBiometricNotice: typeof clearBiometricNotice
  emitBiometricNotice: typeof emitBiometricNotice
  resolveBiometricOptIn: typeof resolveBiometricOptIn
  shouldBlockOnSecureFailure: typeof shouldBlockOnSecureFailure
}

export const getKeystoreMobileBridge = (): KeystoreMobileBridge => ({
  biometricNotice$,
  clearBiometricNotice,
  emitBiometricNotice,
  resolveBiometricOptIn,
  shouldBlockOnSecureFailure
})
