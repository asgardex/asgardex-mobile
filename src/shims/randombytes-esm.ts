/**
 * ESM-compatible replacement for the `randombytes` package.
 *
 * This shim bypasses the CJS `randombytes/browser.js` which causes
 * "exports is not defined" errors when bundled into ESM output.
 *
 * Uses Web Crypto API (crypto.getRandomValues) which is available in
 * all modern browsers and Android WebView.
 */

import { Buffer } from 'buffer'

type RandomBytesCallback = (err: Error | null, buf?: Buffer) => void

/**
 * Generate cryptographically secure random bytes.
 * API-compatible with Node's crypto.randomBytes and the randombytes package.
 *
 * Note: This file intentionally exports **only a default function**.
 * Some Browserify-era CJS consumers (`crypto-browserify`) do `require('randombytes')`
 * and expect a callable function. With Rollup's `requireReturnsDefault: "auto"`,
 * any named exports would cause `require()` to receive a namespace object instead,
 * leading to runtime `randomBytes is not a function` on Android.
 */
const randomBytes = (size: number, cb?: RandomBytesCallback): Buffer | void => {
  if (!Number.isSafeInteger(size) || size < 0) {
    const err = new RangeError('size must be a non-negative integer')
    if (cb) {
      cb(err)
      return
    }
    throw err
  }

  const crypto = globalThis.crypto as Crypto | undefined
  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    const err = new Error(
      'Secure random number generation is not supported by this environment. ' +
        'Ensure the browser/WebView exposes crypto.getRandomValues.'
    )
    if (cb) {
      cb(err)
      return
    }
    throw err
  }

  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)

  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (cb) {
    cb(null, buf)
    return
  }

  return buf
}

export default randomBytes
