import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import inject from '@rollup/plugin-inject'
import react from '@vitejs/plugin-react'
import simpleGit from 'simple-git'
import { defineConfig } from 'vite'
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
        },
        plugins: [
          inject({
            Buffer: ['buffer', 'Buffer']
          })
        ]
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
        process: 'process/browser',
        stream: 'stream-browserify',
        crypto: 'crypto-browserify',
        assert: 'assert',
        path: path.resolve(__dirname, 'empty.js'),
        url: path.resolve(__dirname, 'empty.js'),
        https: path.resolve(__dirname, 'empty.js'),
        http: path.resolve(__dirname, 'empty.js'),
        zlib: path.resolve(__dirname, 'empty.js'),
        // Force @mayaprotocol/zcash-js to use CommonJS build instead of browser bundle
        '@mayaprotocol/zcash-js': path.resolve(__dirname, 'node_modules/@mayaprotocol/zcash-js/dist/src/index.js')
      }
    },
    optimizeDeps: {
      include: ['process', 'buffer', 'assert', '@mayaprotocol/zcash-js'],
      esbuildOptions: {
        inject: ['./src/shims/buffer-shim.js']
      }
    },
    plugins: [wasm(), react(), svgr()],
    define: {
      'process.env': {},
      global: 'globalThis',
      $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
      $VERSION: JSON.stringify(pkg.version),
      $IS_DEV: JSON.stringify(isDev)
    }
  }
})
