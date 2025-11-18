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
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            crypto: ['crypto-browserify', 'stream-browserify', 'readable-stream']
          }
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/node_modules/, /@mayaprotocol\/zcash-js/]
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
        '@mayaprotocol/zcash-js': path.resolve(__dirname, 'node_modules/@mayaprotocol/zcash-js/dist/src/index.js')
      }
    },
    optimizeDeps: {
      include: ['@mayaprotocol/zcash-js']
    },
    plugins: [
      wasm(),
      react(),
      svgr(),
      // Node.js polyfills for browser compatibility.
      // Required because crypto dependencies (pbkdf2, readable-stream@2.x, hash-base)
      // use Node built-ins like `util`, `stream`, `crypto`, and `process.version`.
      // These packages are pinned via resolutions in package.json for security fixes,
      // but their latest versions still depend on Node APIs.
      // See: https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility
      nodePolyfills({
        include: ['process', 'buffer', 'stream', 'crypto', 'assert', 'util', 'events'],
        globals: {
          Buffer: true,
          global: true,
          process: true
        }
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
