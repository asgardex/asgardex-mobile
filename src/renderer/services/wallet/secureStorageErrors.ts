import { isError } from '../../../shared/utils/guard'

export const SECURE_STORAGE_WRITE_ERROR = 'SecureStorageWriteError' as const
export const SECURE_STORAGE_REQUIRED_ERROR = 'SecureStorageRequiredError' as const
export const SECURE_STORAGE_VERSION_MISMATCH_ERROR = 'SecureStorageVersionMismatchError' as const

export type SecureStorageWriteError = Error & { name: typeof SECURE_STORAGE_WRITE_ERROR; cause?: unknown }

export type SecureStorageRequiredError = Error & {
  name: typeof SECURE_STORAGE_REQUIRED_ERROR
  cause?: unknown
  retryable: boolean
}

export type SecureStorageVersionMismatchError = Error & {
  name: typeof SECURE_STORAGE_VERSION_MISMATCH_ERROR
  expected: number
  actual: number | null
}

export const createSecureStorageWriteError = (reason: unknown): SecureStorageWriteError => {
  const normalized = isError(reason) ? reason : Error(String(reason ?? 'Unknown secure storage error'))
  const message = normalized.message || 'Unknown secure storage error'
  const error = new Error(`Secure storage failed: ${message}`)
  error.name = SECURE_STORAGE_WRITE_ERROR
  ;(error as SecureStorageWriteError).cause = normalized
  return error as SecureStorageWriteError
}

export const createSecureStorageRequiredError = (reason: unknown): SecureStorageRequiredError => {
  const normalized = isError(reason) ? reason : Error(String(reason ?? 'Secure storage unavailable'))
  const message = normalized.message || 'Secure storage unavailable'
  const error = new Error(
    `Wallet creation blocked: secure storage is required on mobile but failed. ${message}`
  ) as SecureStorageRequiredError
  error.name = SECURE_STORAGE_REQUIRED_ERROR
  error.cause = normalized
  error.retryable = true
  return error
}

export const createSecureStorageVersionMismatchError = (
  expected: number,
  actual: number | null
): SecureStorageVersionMismatchError => {
  const expectedLabel = String(expected)
  const actualLabel = actual === null ? 'unknown' : String(actual)
  const error = new Error(
    `Secure storage payload version mismatch: expected ${expectedLabel}, received ${actualLabel}`
  ) as SecureStorageVersionMismatchError
  error.name = SECURE_STORAGE_VERSION_MISMATCH_ERROR
  error.expected = expected
  error.actual = actual
  return error
}

export const isSecureStorageWriteError = (error: unknown): error is SecureStorageWriteError =>
  isError(error) && error.name === SECURE_STORAGE_WRITE_ERROR

export const isSecureStorageRequiredError = (error: unknown): error is SecureStorageRequiredError =>
  isError(error) && error.name === SECURE_STORAGE_REQUIRED_ERROR

export const isSecureStorageVersionMismatchError = (error: unknown): error is SecureStorageVersionMismatchError =>
  isError(error) && error.name === SECURE_STORAGE_VERSION_MISMATCH_ERROR

export const getSecureStorageFailureReason = (error: SecureStorageWriteError): string => {
  const causeMessage = isError(error.cause) ? error.cause.message : undefined
  if (causeMessage && causeMessage.trim().length > 0) return causeMessage
  return error.message.replace(/^secure storage failed:\s*/i, '').trim()
}

export const getSecureStorageRequiredGuidance = (error: SecureStorageRequiredError): string => {
  const base = 'Please ensure your device has a passcode/PIN set and try again.'
  const causeMessage = isError(error.cause) ? error.cause.message : undefined
  if (causeMessage && /permission|denied|auth/i.test(causeMessage)) {
    return `${base} You may need to grant storage permissions in device settings.`
  }
  return base
}

export const getSecureStorageRequiredDetail = (error: SecureStorageRequiredError): string | null => {
  const causeMessage = isError(error.cause) ? error.cause.message?.trim() : undefined
  if (!causeMessage) return null
  return causeMessage.length > 0 ? causeMessage : null
}
