import inject from '@rollup/plugin-inject'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    inject({
      Buffer: ['buffer', 'Buffer']
    }),
    visualizer({
      open: false,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true
    })
  ],
  resolve: {
    alias: {
      process: 'process/browser',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      assert: 'assert/'
    }
  },
  optimizeDeps: {
    include: ['process', 'buffer']
  },
  define: {
    'process.env': {},
    global: 'globalThis',
    $COMMIT_HASH: JSON.stringify(process.env.COMMIT_HASH || 'dev'),
    $VERSION: JSON.stringify(process.env.npm_package_version),
    $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
  }
})
