/**
 * Production Runtime Smoke Tests
 *
 * These tests validate that critical code paths work correctly when running
 * with production polyfills (via `yarn test:prod-config`).
 *
 * Purpose: Catch production-only failures before they reach Android WebView:
 * - Polyfill issues (Buffer, crypto, stream)
 * - ESM module resolution problems
 * - Crypto/wallet initialization failures
 *
 * Design principles:
 * - NO MOCKS - tests real polyfilled code
 * - NO NETWORK CALLS - fast execution
 * - CLEAR FAILURE MESSAGES - identify which polyfill failed
 */

import { describe, expect, it } from 'vitest'

describe('Production Runtime Smoke Tests', () => {
  describe('Web Crypto API', () => {
    it('crypto.getRandomValues() is available and functional', () => {
      expect(globalThis.crypto).toBeDefined()
      expect(globalThis.crypto.getRandomValues).toBeDefined()

      const array = new Uint8Array(32)
      const result = globalThis.crypto.getRandomValues(array)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(32)
      // Verify it's not all zeros (extremely unlikely for random data)
      expect(result.some((byte) => byte !== 0)).toBe(true)
    })

    it('crypto.subtle is available', () => {
      expect(globalThis.crypto.subtle).toBeDefined()
      expect(globalThis.crypto.subtle.digest).toBeDefined()
    })
  })

  describe('Buffer Polyfill', () => {
    it('Buffer.from() works with string input', () => {
      const buf = Buffer.from('hello world', 'utf8')
      expect(buf).toBeInstanceOf(Uint8Array)
      expect(buf.toString('utf8')).toBe('hello world')
    })

    it('Buffer.from() works with hex input', () => {
      const buf = Buffer.from('deadbeef', 'hex')
      expect(buf.length).toBe(4)
      expect(buf.toString('hex')).toBe('deadbeef')
    })

    it('Buffer.alloc() creates zero-filled buffer', () => {
      const buf = Buffer.alloc(16)
      expect(buf.length).toBe(16)
      expect(buf.every((byte) => byte === 0)).toBe(true)
    })

    it('Buffer.concat() merges buffers', () => {
      const a = Buffer.from([1, 2])
      const b = Buffer.from([3, 4])
      const combined = Buffer.concat([a, b])
      expect(Array.from(combined)).toEqual([1, 2, 3, 4])
    })
  })

  describe('Custom Crypto Shims', () => {
    it('crypto shim exposes randomBytes on default export', async () => {
      // This test specifically catches the "randomBytes is not a function" bug
      // where CJS/ESM interop causes crypto.default.randomBytes to be undefined
      const cryptoMod = await import('crypto')

      // Must have a usable default export object
      expect(cryptoMod.default).toBeDefined()
      expect(typeof cryptoMod.default).toBe('object')

      // randomBytes must be a function on the default export
      // This is the exact pattern xchain-crypto uses: `import crypto from 'crypto'; crypto.randomBytes(...)`
      expect(typeof cryptoMod.default.randomBytes).toBe('function')

      // Actually call it to verify it works
      const bytes = cryptoMod.default.randomBytes(16)
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(16)
      expect(bytes.some((byte: number) => byte !== 0)).toBe(true)
    })

    it('randombytes shim produces random bytes', async () => {
      // Dynamic import to test the shim resolution
      // @ts-expect-error - no types for randombytes, testing the shim works at runtime
      const randombytesModule = await import('randombytes')
      const randomBytes = randombytesModule.default || randombytesModule

      expect(randomBytes).toBeDefined()
      expect(typeof randomBytes).toBe('function')

      const bytes = randomBytes(32) as Uint8Array
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(32)
      expect(bytes.some((byte: number) => byte !== 0)).toBe(true)
    })

    it('randomfill shim fills buffer with random data', async () => {
      // @ts-expect-error - no types for randomfill, testing the shim works at runtime
      const randomfillModule = await import('randomfill')
      // The shim exports randomFill as a property on the default export
      const randomFill = randomfillModule.default?.randomFill || randomfillModule.randomFill

      expect(randomFill).toBeDefined()
      expect(typeof randomFill).toBe('function')

      const buf = Buffer.alloc(32)
      await new Promise<void>((resolve, reject) => {
        randomFill(buf, (err: Error | null) => {
          if (err) reject(err)
          else resolve()
        })
      })

      expect(buf.some((byte: number) => byte !== 0)).toBe(true)
    })
  })

  describe('xchain-crypto (Wallet Operations)', () => {
    it('exports are available', async () => {
      const crypto = await import('@xchainjs/xchain-crypto')

      expect(crypto.generatePhrase).toBeDefined()
      expect(crypto.validatePhrase).toBeDefined()
      expect(crypto.encryptToKeyStore).toBeDefined()
      expect(crypto.decryptFromKeystore).toBeDefined()
    })

    it('generatePhrase() produces valid mnemonic', async () => {
      const { generatePhrase, validatePhrase } = await import('@xchainjs/xchain-crypto')

      const phrase = generatePhrase(12)

      expect(typeof phrase).toBe('string')
      const words = phrase.split(' ')
      expect(words.length).toBe(12)
      expect(validatePhrase(phrase)).toBe(true)
    })

    it('validatePhrase() rejects invalid mnemonic', async () => {
      const { validatePhrase } = await import('@xchainjs/xchain-crypto')

      expect(validatePhrase('invalid mnemonic phrase that is not real')).toBe(false)
      expect(validatePhrase('')).toBe(false)
    })

    it('encryptToKeyStore/decryptFromKeystore round-trip works', async () => {
      const { generatePhrase, encryptToKeyStore, decryptFromKeystore } = await import('@xchainjs/xchain-crypto')

      const phrase = generatePhrase(12)
      const password = 'test-password-123'

      const keystore = await encryptToKeyStore(phrase, password)

      expect(keystore).toBeDefined()
      expect(keystore.crypto).toBeDefined()
      expect(keystore.version).toBeDefined()

      const decrypted = await decryptFromKeystore(keystore, password)
      expect(decrypted).toBe(phrase)
    })
  })

  describe('Chain Client Imports (Representative Subset)', () => {
    it('Bitcoin client module loads', async () => {
      const btcModule = await import('@xchainjs/xchain-bitcoin')

      expect(btcModule.Client).toBeDefined()
      expect(typeof btcModule.Client).toBe('function')
    })

    it('Ethereum client module loads', async () => {
      const ethModule = await import('@xchainjs/xchain-ethereum')

      expect(ethModule.Client).toBeDefined()
      expect(typeof ethModule.Client).toBe('function')
    })

    it('THORChain client module loads', async () => {
      const thorModule = await import('@xchainjs/xchain-thorchain')

      expect(thorModule.Client).toBeDefined()
      expect(typeof thorModule.Client).toBe('function')
    })

    it('Solana client module loads', async () => {
      const solModule = await import('@xchainjs/xchain-solana')

      expect(solModule.Client).toBeDefined()
      expect(typeof solModule.Client).toBe('function')
    })
  })

  describe('Core Browser APIs', () => {
    it('fetch is defined', () => {
      expect(globalThis.fetch).toBeDefined()
      expect(typeof globalThis.fetch).toBe('function')
    })

    it('URL constructor works', () => {
      const url = new URL('https://example.com/path?query=value')

      expect(url.hostname).toBe('example.com')
      expect(url.pathname).toBe('/path')
      expect(url.searchParams.get('query')).toBe('value')
    })

    it('URLSearchParams works', () => {
      const params = new URLSearchParams({ foo: 'bar', baz: '123' })

      expect(params.get('foo')).toBe('bar')
      expect(params.get('baz')).toBe('123')
      expect(params.toString()).toContain('foo=bar')
    })

    it('TextEncoder/TextDecoder work', () => {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      const encoded = encoder.encode('hello')
      expect(encoded).toBeInstanceOf(Uint8Array)

      const decoded = decoder.decode(encoded)
      expect(decoded).toBe('hello')
    })
  })

  describe('Process/Global Polyfills', () => {
    it('process.env is accessible', () => {
      expect(process).toBeDefined()
      expect(process.env).toBeDefined()
    })

    it('global Buffer reference works', () => {
      // Some libraries use global.Buffer
      expect(globalThis.Buffer).toBeDefined()
      expect(globalThis.Buffer.from).toBeDefined()
    })
  })
})
