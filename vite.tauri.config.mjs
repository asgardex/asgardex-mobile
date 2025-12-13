import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import simpleGit from 'simple-git'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import wasm from 'vite-plugin-wasm'

import { createSharedAliases, createSharedDefine, sharedNodePolyfills } from './vite.shared.config.mjs'

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
        onwarn(warning, warn) {
          const message = warning?.message ?? ''
          const isExternalized =
            warning?.plugin === 'vite:resolve' && message.includes('has been externalized for browser compatibility')

          if (isExternalized && !isDev) {
            throw new Error(message)
          }

          warn(warning)
        },
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
        ...createSharedAliases(__dirname)
      }
    },
    optimizeDeps: {
      // Dev-only pre-bundling for a few known CJS packages.
      include: ['@mayaprotocol/zcash-js']
    },
    plugins: [wasm(), react(), svgr(), sharedNodePolyfills(__dirname)],
    define: createSharedDefine({ commitHash, version: pkg.version, isDev })
  }
})
