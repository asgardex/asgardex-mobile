import { SecureStoragePayload } from '../api/types'

export type BiometricDowngradeReason =
  | 'biometryNotEnrolled'
  | 'biometryNotAvailable'
  | 'passcodeNotSet'
  | 'statusError'
  | 'pluginUnavailable'

export type BiometricDowngradeMeta = {
  secureKeyId: string
  reason: BiometricDowngradeReason
  payload: SecureStoragePayload
  statusError?: string
}

const BIOMETRIC_DOWNGRADE_FLAG = Symbol('asgardex:biometric-downgrade')

export class BiometricDowngradeError extends Error {
  readonly [BIOMETRIC_DOWNGRADE_FLAG] = true
  readonly secureKeyId: string
  readonly reason: BiometricDowngradeReason
  private readonly _payload!: SecureStoragePayload
  private readonly _statusError!: string | undefined

  constructor(message: string, meta: BiometricDowngradeMeta) {
    super(message)
    this.name = 'BiometricDowngradeError'
    this.secureKeyId = meta.secureKeyId
    this.reason = meta.reason
    Object.defineProperty(this, '_payload', {
      value: meta.payload,
      enumerable: false,
      writable: false,
      configurable: false
    })
    Object.defineProperty(this, '_statusError', {
      value: meta.statusError,
      enumerable: false,
      writable: false,
      configurable: false
    })
  }

  get payload(): SecureStoragePayload {
    return this._payload
  }

  get statusError(): string | undefined {
    return this._statusError
  }
}

export const isBiometricDowngradeError = (value: unknown): value is BiometricDowngradeError =>
  value instanceof BiometricDowngradeError ||
  Boolean((value as { [BIOMETRIC_DOWNGRADE_FLAG]?: boolean })?.[BIOMETRIC_DOWNGRADE_FLAG])
