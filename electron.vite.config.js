import inject from '@rollup/plugin-inject'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
// import { visualizer } from 'rollup-plugin-visualizer'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  main: {
    build: {
      sourcemap: process.env.NODE_ENV !== 'production',
      outDir: 'build/main',
      lib: { entry: 'src/main/electron.ts' }
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    plugins: [externalizeDepsPlugin()],
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
    plugins: [externalizeDepsPlugin()],
    resolve: {
      extensions: ['.ts', '.js']
    }
  },

  renderer: {
    build: {
      outDir: 'build/renderer',
      rollupOptions: {
        input: 'src/renderer/index.html',
        plugins: [
          inject({
            Buffer: ['buffer', 'Buffer']
          }),
          // visualizer({
          //   open: true,
          //   filename: 'stats.html',
          //   gzipSize: true,
          //   brotliSize: true
          // })
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
        // buffer: 'buffer'
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
    plugins: [react(), svgr()],
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
