/**
 * ESM-compatible replacement for the `randomfill` package.
 *
 * The upstream `randomfill/browser.js` is CommonJS and leaks bare `exports`
 * into ESM bundles on Android WebView, causing `exports is not defined`.
 *
 * This shim implements the same API using Web Crypto (getRandomValues).
 */

import { Buffer } from 'buffer'

export type RandomFillCallback = (err: Error | null, buf?: Buffer | Uint8Array) => void

const kMaxUint32 = 0xffffffff
// Browser Buffer polyfill doesn't expose kMaxLength; use Node-equivalent cap.
const kBufferMaxLength = 0x7fffffff

function assertOffset(offset: number, length: number) {
  if (typeof offset !== 'number' || offset !== offset) {
    throw new TypeError('offset must be a number')
  }
  if (offset > kMaxUint32 || offset < 0) {
    throw new TypeError('offset must be a uint32')
  }
  if (offset > kBufferMaxLength || offset > length) {
    throw new RangeError('offset out of range')
  }
}

function assertSize(size: number, offset: number, length: number) {
  if (typeof size !== 'number' || size !== size) {
    throw new TypeError('size must be a number')
  }
  if (size > kMaxUint32 || size < 0) {
    throw new TypeError('size must be a uint32')
  }
  if (size + offset > length || size > kBufferMaxLength) {
    throw new RangeError('buffer too small')
  }
}

function getCrypto(): Crypto {
  const crypto = globalThis.crypto as Crypto | undefined
  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    throw new Error(
      'secure random number generation not supported by this environment. ' +
        'Ensure Android WebView exposes crypto.getRandomValues.'
    )
  }
  return crypto
}

function actualFill(
  buf: Buffer | Uint8Array,
  offset: number,
  size: number,
  cb?: RandomFillCallback
): Buffer | Uint8Array | void {
  const crypto = getCrypto()
  const view = new Uint8Array(buf.buffer, buf.byteOffset + offset, size)
  crypto.getRandomValues(view)

  if (cb) {
    queueMicrotask(() => cb(null, buf))
    return
  }

  return buf
}

function randomFill(
  buf: Buffer | Uint8Array,
  offset?: number | RandomFillCallback,
  size?: number | RandomFillCallback,
  cb?: RandomFillCallback
): Buffer | Uint8Array | void {
  if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) {
    throw new TypeError('"buf" argument must be a Buffer or Uint8Array')
  }

  if (typeof offset === 'function') {
    cb = offset
    offset = 0
    size = buf.length
  } else if (typeof size === 'function') {
    cb = size
    size = buf.length - (offset ?? 0)
  } else if (typeof cb !== 'function') {
    throw new TypeError('"cb" argument must be a function')
  }

  const resolvedOffset = typeof offset === 'number' ? offset : 0
  const resolvedSize = typeof size === 'number' ? size : buf.length - resolvedOffset

  assertOffset(resolvedOffset, buf.length)
  assertSize(resolvedSize, resolvedOffset, buf.length)

  return actualFill(buf, resolvedOffset, resolvedSize, cb)
}

function randomFillSync(buf: Buffer | Uint8Array, offset: number = 0, size?: number): Buffer | Uint8Array {
  if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) {
    throw new TypeError('"buf" argument must be a Buffer or Uint8Array')
  }

  assertOffset(offset, buf.length)
  const resolvedSize = size === undefined ? buf.length - offset : size
  assertSize(resolvedSize, offset, buf.length)

  return actualFill(buf, offset, resolvedSize) as Buffer | Uint8Array
}

// API compatibility: default export is a callable function with attached properties,
// matching the upstream CommonJS `randomfill` module.
type RandomFillModule = typeof randomFill & {
  randomFill: typeof randomFill
  randomFillSync: typeof randomFillSync
}

const randomfill = Object.assign(randomFill, {
  randomFill,
  randomFillSync
}) as RandomFillModule

export default randomfill
