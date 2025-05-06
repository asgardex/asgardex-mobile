import { builtinModules } from 'module'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  main: {
    build: {
      sourcemap: process.env.NODE_ENV !== 'production',
      outDir: 'build/main',
      lib: { entry: 'src/main/electron.ts' },
      rollupOptions: {
        external: [...builtinModules, 'node-hid', 'usb']
      }
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    define: {
      $COMMIT_HASH: JSON.stringify(process.env.COMMIT_HASH || 'dev'),
      $VERSION: JSON.stringify(process.env.npm_package_version),
      $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
    }
  },

  preload: {
    build: {
      lib: { entry: 'src/main/preload.ts' },
      outDir: 'build/preload',
      sourcemap: process.env.NODE_ENV !== 'production'
    },
    resolve: {
      extensions: ['.ts', '.js']
    }
  },

  renderer: {
    build: {
      outDir: 'build/renderer',
      rollupOptions: {
        input: 'src/renderer/index.html'
      }
    },
    resolve: {
      alias: {
        buffer: 'buffer',
        stream: 'stream-browserify',
        crypto: 'crypto-browserify'
        // os: 'os-browserify/browser',
        // path: 'path-browserify',
        // fs: 'browserify-fs',
        // assert: 'assert'
        // process: 'process/browser'
      }
    },
    optimizeDeps: {
      include: ['process', 'buffer'],
      esbuildOptions: {
        inject: ['./src/shims/buffer-shim.js']
      }
    },
    plugins: [
      // Usa @vitejs/plugin-react si usas React
      // Usa vite-plugin-svgr para importar SVG como componentes
      // nodePolyfills(),
      react(),
      svgr()
      // inject({
      //   global: ['globalThis']
      // })
    ],
    define: {
      'process.env': {}, // TODO: Fix from xchain
      global: 'globalThis',
      $COMMIT_HASH: JSON.stringify(process.env.COMMIT_HASH || 'dev'),
      $VERSION: JSON.stringify(process.env.npm_package_version),
      $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
    },
    server: {
      port: 3000
    }
  }
})
