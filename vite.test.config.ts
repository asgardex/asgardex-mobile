import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { createSharedAliases, createSharedDefine, sharedNodePolyfills } from './vite.shared.config.mjs'

const useProdConfig = process.env.VITE_NODE_ENV === 'production'
const sharedDefine = createSharedDefine({
  version: process.env.npm_package_version,
  isDev: !useProdConfig
})
// In Vitest (Node) we must not redefine process.* or global,
// otherwise Vite injects @vite/env which tries to mutate read-only props.
const testDefine = Object.fromEntries(
  Object.entries(sharedDefine).filter(([key]) => !key.startsWith('process.') && key !== 'global')
)

export default defineConfig({
  plugins: [react(), ...(useProdConfig ? [sharedNodePolyfills(__dirname)] : [])],
  resolve: {
    alias: {
      ...createSharedAliases(__dirname),
      '@ledgerhq/evm-tools/': path.resolve(__dirname, 'node_modules/@ledgerhq/evm-tools/lib/selectors'),
      '@ledgerhq/domain-service/': path.resolve(__dirname, 'node_modules/@ledgerhq/domain-service/lib/signers'),
      '@ledgerhq/cryptoassets/': path.resolve(__dirname, 'node_modules/@ledgerhq/cryptoassets/lib/data/evm')
    }
  },
  define: testDefine,
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./setup.vitest.js', './src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'build',
      // Vite dev resolution test runs in Node environment without DOM setup
      'src/renderer/tauri/vite-dev-resolve.test.ts',
      // Rebase integrity checks rely on Node fs and should not run under prod polyfills.
      ...(useProdConfig ? ['src/renderer/tauri/rebase.test.ts'] : [])
    ],
    css: false,
    alias: {
      '\\.(css|less)$': './__mocks__/styleMock.js'
    },
    deps: {
      optimizer: {
        web: {
          include: [
            'uuid',
            'axios',
            '@xchainjs/',
            '@metaplex-foundation/',
            '@ledgerhq/domain-service',
            '@ledgerhq/hw-app-eth',
            '@cosmjs/tendermint-rpc',
            '@bitcoin-js/tiny-secp256k1-asmjs',
            'uint8array-tools'
          ]
        }
      }
    }
  }
})
