import inject from '@rollup/plugin-inject'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import simpleGit from 'simple-git'
import svgr from 'vite-plugin-svgr'

import pkg from './package.json'

const git = simpleGit()

export default defineConfig(async () => {
  const commitHash = (await git.revparse(['--short', 'HEAD'])).trim()
  return {
    main: {
      build: {
        sourcemap: process.env.NODE_ENV !== 'production',
        outDir: 'build/main',
        lib: { entry: 'src/main/electron.ts' }
      },
      resolve: {
        extensions: ['.ts', '.js']
      },
      plugins: [
        externalizeDepsPlugin({
          include: ['@ledgerhq/hw-transport-node-hid', '@ledgerhq/hw-transport', 'node-hid', 'usb']
        })
      ],
      define: {
        $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
        $VERSION: JSON.stringify(pkg.version),
        $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
      }
    },

    preload: {
      build: {
        lib: { entry: 'src/main/preload.ts' },
        outDir: 'build/preload',
        sourcemap: process.env.NODE_ENV !== 'production'
      },
      plugins: [externalizeDepsPlugin()],
      resolve: {
        extensions: ['.ts', '.js']
      }
    },

    renderer: {
      build: {
        outDir: 'build/renderer',
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              crypto: ['crypto-browserify', 'stream-browserify', 'readable-stream'],
              xchain: [
                '@xchainjs/xchain-wallet',
                '@xchainjs/xchain-doge',
                '@xchainjs/xchain-litecoin',
                '@xchainjs/xchain-bitcoin',
                '@xchainjs/xchain-ethereum',
                '@xchainjs/xchain-cosmos',
                '@xchainjs/xchain-thorchain',
                '@xchainjs/xchain-client',
                '@xchainjs/xchain-crypto',
                '@xchainjs/xchain-util'
              ]
            }
          },
          input: 'src/renderer/index.html',
          plugins: [
            inject({
              Buffer: ['buffer', 'Buffer']
            })
          ]
        },
        commonjsOptions: {
          transformMixedEsModules: false
        }
      },
      resolve: {
        alias: {
          process: 'process/browser',
          stream: 'stream-browserify',
          crypto: 'crypto-browserify',
          url: './empty.js',
          https: './empty.js',
          http: './empty.js',
          zlib: './empty.js',
          path: './empty.js',
          fs: './empty.js'
        }
      },
      optimizeDeps: {
        include: ['process', 'buffer'],
        esbuildOptions: {
          inject: ['./src/shims/buffer-shim.js']
        }
      },
      plugins: [react(), svgr()],
      define: {
        'process.env': {}, // TODO: Fix from xchain
        global: 'globalThis',
        $COMMIT_HASH: JSON.stringify(commitHash || 'dev'),
        $VERSION: JSON.stringify(pkg.version),
        $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
      },
      server: {
        port: 3000
      }
    }
  }
})
