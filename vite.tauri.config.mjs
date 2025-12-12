import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import simpleGit from 'simple-git'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'
import wasm from 'vite-plugin-wasm'

const git = simpleGit()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

export default defineConfig(async ({ mode }) => {
  const commitHash = (await git.revparse(['--short', 'HEAD'])).trim()
  const isDev = mode === 'development'

  return {
    root: path.resolve(__dirname, 'src/renderer'),
    base: './',
    publicDir: path.resolve(__dirname, 'public'),
    assetsInclude: ['**/*.wasm'],
    server: {
      port: 3000,
      host: true
    },
    build: {
      target: 'es2022',
      outDir: path.resolve(__dirname, 'build/renderer'),
      emptyOutDir: true,
      sourcemap: isDev,
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.html'),
        output: {
          // Only split vendor chunk - don't manually chunk crypto polyfills
          // as they contain CommonJS code that needs proper transformation
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom']
          }
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true,
        // Ensure all node_modules are transformed from CommonJS to ESM
        include: [/node_modules/],
        // Force CommonJS detection for problematic packages
        requireReturnsDefault: 'auto'
      }
    },
    esbuild: {
      target: 'es2022'
    },
    resolve: {
      alias: {
        // Use asm.js build to avoid WASM top-level await issues with CommonJS consumers (bip32, bitcoinjs-lib)
        'tiny-secp256k1': '@bitcoin-js/tiny-secp256k1-asmjs',
        // Force @mayaprotocol/zcash-js to use CommonJS build instead of browser bundle
        '@mayaprotocol/zcash-js': path.resolve(__dirname, 'node_modules/@mayaprotocol/zcash-js/dist/src/index.js'),
        // ESM shims for crypto-browserify dependencies to avoid "exports is not defined" error.
        // These packages use CJS module.exports which leaks into the ESM bundle
        // and crashes in browser environments without a CommonJS runtime.
        randombytes: path.resolve(__dirname, 'src/shims/randombytes-esm.ts'),
        'safe-buffer': path.resolve(__dirname, 'src/shims/safe-buffer-esm.ts'),
        randomfill: path.resolve(__dirname, 'src/shims/randomfill-esm.ts')
      }
    },
    optimizeDeps: {
      // Dev-only pre-bundling for a few known CJS packages.
      include: ['@mayaprotocol/zcash-js']
    },
    plugins: [
      wasm(),
      react(),
      svgr(),
      // Node.js polyfills for browser compatibility.
      // Use protocolImports: true to get ESM-compatible polyfills that work in production builds.
      // This avoids the "exports is not defined" error from CJS polyfills in ESM bundles.
      nodePolyfills({
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
        protocolImports: true
      })
    ],
    define: {
      'process.env': {},
      // Required by readable-stream@2.x which calls process.version.slice() at init time.
      // Without this, the app crashes with "Cannot read properties of undefined (reading 'slice')".
      'process.version': JSON.stringify('v18.0.0'),
      'process.browser': JSON.stringify(true),
      global: 'globalThis',
      $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
      $VERSION: JSON.stringify(pkg.version),
      $IS_DEV: JSON.stringify(isDev)
    }
  }
})
