import { KeystoreId } from '../../../shared/api/types'
import { safeStringify } from '../../../shared/utils/safeStringify'
import { isError } from '../../../shared/utils/guard'

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

const rightRotate = (value: number, amount: number): number => (value >>> amount) | (value << (32 - amount))

const encodeUtf8 = (value: string): Uint8Array => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value)
  }
  const result = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i++) {
    result[i] = value.charCodeAt(i) & 0xff
  }
  return result
}

const sha256Hex = (input: string): string => {
  const message = encodeUtf8(input)
  const messageLength = message.length
  const bitLength = messageLength * 8
  const paddedLength = ((messageLength + 9 + 63) & ~63) >>> 0
  const padded = new Uint8Array(paddedLength)
  padded.set(message)
  padded[messageLength] = 0x80

  const view = new DataView(padded.buffer)
  const highBits = Math.floor(bitLength / 0x100000000)
  const lowBits = bitLength >>> 0
  view.setUint32(paddedLength - 8, highBits >>> 0, false)
  view.setUint32(paddedLength - 4, lowBits, false)

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      words[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(words[i - 15], 7) ^ rightRotate(words[i - 15], 18) ^ (words[i - 15] >>> 3)
      const s1 = rightRotate(words[i - 2], 17) ^ rightRotate(words[i - 2], 19) ^ (words[i - 2] >>> 10)
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0
    }

    let a = state[0]
    let b = state[1]
    let c = state[2]
    let d = state[3]
    let e = state[4]
    let f = state[5]
    let g = state[6]
    let h = state[7]

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + SHA256_K[i] + words[i]) >>> 0
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0
    state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0
    state[7] = (state[7] + h) >>> 0
  }

  let output = ''
  for (let i = 0; i < state.length; i++) {
    output += state[i].toString(16).padStart(8, '0')
  }
  return output
}

export type SecureStorageAction =
  | 'write_success'
  | 'write_failure'
  | 'write_persist_failure'
  | 'unlock_success'
  | 'unlock_failure'
  | 'remove'
  | 'remove_failure'
  | 'onboarding_blocked'
  | 'version_mismatch'
  | 'biometric_success'
  | 'biometric_failure'
  | 'biometric_downgraded'
  | 'biometric_downgrade_consumed'
  | 'biometric_toggle'
  | 'export_initiated'
  | 'export_completed'
  | 'export_canceled'

export type SecureStorageTelemetry = {
  action: SecureStorageAction
  occurredAt: string
  walletId?: KeystoreId
  secureKeyId?: string
  deviceType: 'ios' | 'android' | 'desktop'
  appVersion: string
  metadata?: Record<string, string>
}

export type SecureStorageTelemetryEvent = {
  event: 'secure_storage'
  payload: SecureStorageTelemetry
}

type TelemetryEvent = SecureStorageTelemetryEvent

export const TELEMETRY_EVENT = 'asgardex:telemetry'

const detectDeviceType = (): SecureStorageTelemetry['deviceType'] => {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const ua = nav?.userAgent?.toLowerCase() ?? ''
  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios'
  return 'desktop'
}

const resolveAppVersion = (): string => {
  const metaVersion = (import.meta as unknown as { env?: Record<string, string> } | undefined)?.env?.VITE_APP_VERSION
  if (metaVersion) return metaVersion
  if (typeof process !== 'undefined') {
    const pkgVersion = (process.env?.npm_package_version ?? process.env?.APP_VERSION) as string | undefined
    if (pkgVersion) return pkgVersion
  }
  return 'dev'
}

let telemetrySalt: string | null = null

const resolveTelemetrySalt = (): string => {
  if (!telemetrySalt) {
    telemetrySalt = `${resolveAppVersion()}::${detectDeviceType()}`
  }
  return telemetrySalt
}

const hashSecureIdentifier = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  return sha256Hex(`${resolveTelemetrySalt()}::${value}`)
}

const SENSITIVE_METADATA_TOKENS = ['mnemonic', 'phrase', 'keystore', 'seed', 'privatekey', 'payload', 'raw', 'secret']

const REDACTED_VALUE = '[redacted]'

const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_METADATA_TOKENS.some((token) => key.toLowerCase().includes(token))

const normalizePrimitive = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'object') {
    return safeStringify(value)
  }
  return undefined
}

const sanitizeUnknown = (value: unknown): unknown => {
  if (value === null || value === undefined) return value

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message
    }
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeUnknown)
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const result: Record<string, unknown> = {}
    entries.forEach(([key, entryValue]) => {
      if (!key) return
      if (isSensitiveKey(key)) {
        result[key] = REDACTED_VALUE
        return
      }
      result[key] = sanitizeUnknown(entryValue)
    })
    return result
  }

  return value
}

const sanitizeMetadata = (metadata?: Record<string, unknown>): Record<string, string> | undefined => {
  if (!metadata) return undefined

  const sanitized = sanitizeUnknown(metadata)
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return undefined

  const result: Record<string, string> = {}
  Object.entries(sanitized as Record<string, unknown>).forEach(([key, value]) => {
    if (!key) return
    if (isSensitiveKey(key)) {
      result[key] = REDACTED_VALUE
      return
    }
    const normalized = normalizePrimitive(value)
    if (normalized !== undefined && normalized !== '[unserializable]') {
      result[key] = normalized
    }
  })

  return Object.keys(result).length > 0 ? result : undefined
}

const dispatchTelemetryEvent = (record: TelemetryEvent): void => {
  const win = typeof window === 'undefined' ? undefined : window
  if (!win?.dispatchEvent) return

  try {
    const EventCtor =
      (win as typeof window & { CustomEvent?: typeof CustomEvent }).CustomEvent ?? globalThis.CustomEvent
    if (typeof EventCtor === 'function') {
      win.dispatchEvent(new EventCtor(TELEMETRY_EVENT, { detail: record }))
    } else {
      win.dispatchEvent(new Event(TELEMETRY_EVENT))
    }
  } catch (error) {
    const normalized = isError(error) ? error : Error(String(error))
    console.warn(`[telemetry] Failed to emit secure storage event: ${normalized.message}`)
  }
}

let forceConsoleLoggingInTests = false

export const __setTelemetryConsoleLoggingForTests = (enabled: boolean): void => {
  forceConsoleLoggingInTests = enabled
}

const isTestEnv = (): boolean => {
  try {
    const envMode = (import.meta as unknown as { env?: { MODE?: string } } | undefined)?.env?.MODE
    if (envMode === 'test') return true
  } catch (_) {}
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
}

const sanitizeSecureStorageLogPayload = (payload: SecureStorageTelemetry) => ({
  action: payload.action,
  occurredAt: payload.occurredAt,
  walletId: payload.walletId,
  deviceType: payload.deviceType,
  appVersion: payload.appVersion
})

export type SecureStorageTelemetryParams = {
  action: SecureStorageAction
  walletId?: KeystoreId
  secureKeyId?: string
  metadata?: Record<string, unknown>
}

export const recordSecureStorageEvent = (params: SecureStorageTelemetryParams): SecureStorageTelemetry => {
  const secureKeyIdHash = hashSecureIdentifier(params.secureKeyId)

  const payload: SecureStorageTelemetry = {
    action: params.action,
    occurredAt: new Date().toISOString(),
    walletId: params.walletId,
    secureKeyId: secureKeyIdHash,
    deviceType: detectDeviceType(),
    appVersion: resolveAppVersion(),
    metadata: sanitizeMetadata(params.metadata)
  }

  const record: SecureStorageTelemetryEvent = {
    event: 'secure_storage',
    payload
  }

  dispatchTelemetryEvent(record)

  if (
    (forceConsoleLoggingInTests || !isTestEnv()) &&
    typeof console !== 'undefined' &&
    typeof console.info === 'function'
  ) {
    console.info('[telemetry]', 'secure_storage', safeStringify(sanitizeSecureStorageLogPayload(payload)))
  }

  return payload
}

export type ExternalLinkTelemetryParams = {
  normalizedUrl: string
  whitelistStatus: 'allowed' | 'blocked'
  result: 'opened' | 'fallback' | 'blocked'
  capabilityState: 'native' | 'fallback'
  sourceSurface?: string
  metadata?: Record<string, unknown>
}
