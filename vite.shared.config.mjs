import path from 'node:path'

import { nodePolyfills } from 'vite-plugin-node-polyfills'

/**
 * Shared Vite settings between production (Tauri) bundling and Vitest.
 * Keeping these in sync helps catch prod-only breakages early.
 */

export const createSharedAliases = (rootDir) => ({
  // Use asm.js build to avoid WASM top-level await issues with CommonJS consumers (bip32, bitcoinjs-lib)
  'tiny-secp256k1': '@bitcoin-js/tiny-secp256k1-asmjs',
  // Force @mayaprotocol/zcash-js to use CommonJS build instead of browser bundle
  '@mayaprotocol/zcash-js': path.resolve(rootDir, 'node_modules/@mayaprotocol/zcash-js/dist/src/index.js'),
  // ESM shims for crypto-browserify dependencies to avoid "exports is not defined" error.
  // The crypto shim wraps crypto-browserify and ensures randomBytes is on the default export
  // for `import crypto from 'crypto'; crypto.randomBytes(...)` pattern used by xchain-crypto.
  crypto: path.resolve(rootDir, 'src/shims/crypto-esm.ts'),
  randombytes: path.resolve(rootDir, 'src/shims/randombytes-esm.ts'),
  'safe-buffer': path.resolve(rootDir, 'src/shims/safe-buffer-esm.ts'),
  randomfill: path.resolve(rootDir, 'src/shims/randomfill-esm.ts')
})

export const createSharedDefine = ({ commitHash, version, isDev } = {}) => ({
  'process.env': {},
  // Required by readable-stream@2.x which calls process.version.slice() at init time.
  'process.version': JSON.stringify('v18.0.0'),
  'process.browser': JSON.stringify(true),
  global: 'globalThis',
  $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
  $VERSION: JSON.stringify(version || 'dev'),
  $IS_DEV: JSON.stringify(!!isDev)
})

export const sharedNodePolyfills = (rootDir) => {
  // Build overrides only when rootDir is provided, to avoid setting undefined values
  const overrides = rootDir
    ? {
        crypto: path.resolve(rootDir, 'src/shims/crypto-esm.ts'),
        randombytes: path.resolve(rootDir, 'src/shims/randombytes-esm.ts'),
        randomfill: path.resolve(rootDir, 'src/shims/randomfill-esm.ts')
      }
    : {}

  return nodePolyfills({
    // Polyfill Node built-ins used by upstream libs (solana/web3, bls, node-fetch, etc.).
    // Missing polyfills cause Vite to externalize these modules and break runtime networking on Android.
    include: [
      'process',
      'buffer',
      'stream',
      'crypto',
      'assert',
      'util',
      'events',
      'path',
      'http',
      'https',
      'zlib',
      'vm',
      'fs'
    ],
    globals: {
      Buffer: true,
      global: true,
      process: true
    },
    // Use ESM-compatible protocol imports instead of CJS polyfills
    protocolImports: true,
    // Override specific polyfills with our ESM-compatible shims.
    // This ensures dev mode (optimizeDeps) uses the same shims as production.
    // Without this, the plugin's internal crypto-browserify polyfill wins in dev mode.
    overrides
  })
}
