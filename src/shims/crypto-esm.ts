/**
 * ESM-compatible shim for Node.js `crypto` module.
 *
 * The `xchain-crypto` package does `import crypto from 'crypto'` and
 * calls `crypto.randomBytes()`. When Vite polyfills `crypto` with
 * `crypto-browserify` (a CJS module), the default import doesn't properly
 * expose `randomBytes`, causing:
 *   "TypeError: import_crypto3.default.randomBytes is not a function"
 *
 * This shim provides randomBytes directly using Web Crypto API,
 * and delegates other methods to crypto-browserify (loaded as a peer).
 *
 * IMPORTANT: This module is used via nodePolyfills({ overrides: { crypto: ... } })
 * which means `import 'crypto-browserify'` will NOT be aliased back to this shim.
 */

import { Buffer } from 'buffer'

// Import crypto-browserify directly - this works because:
// 1. In production build: Rollup bundles it with proper CJS transformation
// 2. In dev mode: We're registered via overrides, so 'crypto-browserify' resolves normally
// @ts-expect-error - crypto-browserify doesn't have types
import * as cryptoBrowserify from 'crypto-browserify'

type RandomBytesCallback = (err: Error | null, buf?: Buffer) => void

/**
 * Generate cryptographically secure random bytes.
 * API-compatible with Node's crypto.randomBytes.
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
      '[crypto-esm-shim] Secure random number generation is not supported. ' +
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

// Get the actual crypto-browserify module (handle both ESM default and CJS shapes)
const cb = (cryptoBrowserify as { default?: typeof cryptoBrowserify }).default || cryptoBrowserify

// Create the shim object with our randomBytes and crypto-browserify's other methods
const cryptoShim = {
  // Primary method needed by xchain-crypto - implemented directly with Web Crypto
  randomBytes,

  // Aliases used by some libraries
  rng: randomBytes,
  pseudoRandomBytes: randomBytes,
  prng: randomBytes,

  // Delegate to crypto-browserify for other methods
  createHash: cb.createHash,
  Hash: cb.Hash,
  createHmac: cb.createHmac,
  Hmac: cb.Hmac,
  getHashes: cb.getHashes,
  pbkdf2: cb.pbkdf2,
  pbkdf2Sync: cb.pbkdf2Sync,
  Cipher: cb.Cipher,
  createCipher: cb.createCipher,
  Cipheriv: cb.Cipheriv,
  createCipheriv: cb.createCipheriv,
  Decipher: cb.Decipher,
  createDecipher: cb.createDecipher,
  Decipheriv: cb.Decipheriv,
  createDecipheriv: cb.createDecipheriv,
  getCiphers: cb.getCiphers,
  listCiphers: cb.listCiphers,
  DiffieHellmanGroup: cb.DiffieHellmanGroup,
  createDiffieHellmanGroup: cb.createDiffieHellmanGroup,
  getDiffieHellman: cb.getDiffieHellman,
  createDiffieHellman: cb.createDiffieHellman,
  DiffieHellman: cb.DiffieHellman,
  createSign: cb.createSign,
  Sign: cb.Sign,
  createVerify: cb.createVerify,
  Verify: cb.Verify,
  createECDH: cb.createECDH,
  publicEncrypt: cb.publicEncrypt,
  privateEncrypt: cb.privateEncrypt,
  publicDecrypt: cb.publicDecrypt,
  privateDecrypt: cb.privateDecrypt,
  randomFill: cb.randomFill,
  randomFillSync: cb.randomFillSync,
  constants: cb.constants
}

// Named exports for ESM consumers
export { randomBytes, randomBytes as rng, randomBytes as pseudoRandomBytes, randomBytes as prng }

// Re-export crypto-browserify methods as named exports
export const createHash = cb.createHash
export const Hash = cb.Hash
export const createHmac = cb.createHmac
export const Hmac = cb.Hmac
export const getHashes = cb.getHashes
export const pbkdf2 = cb.pbkdf2
export const pbkdf2Sync = cb.pbkdf2Sync
export const createCipheriv = cb.createCipheriv
export const createDecipheriv = cb.createDecipheriv

// Default export: the full crypto object
// This ensures `import crypto from 'crypto'; crypto.randomBytes(...)` works
export default cryptoShim
