/**
 * Vite Dev Mode Resolution Tests
 *
 * These tests verify that critical module aliases resolve correctly in development mode.
 * This specifically catches the bug where vite-plugin-node-polyfills overrides our
 * custom crypto shim in dev mode (via optimizeDeps), causing "randomBytes is not a function".
 */

// Tell Vitest to use Node environment (no DOM)
// @vitest-environment node

import path from 'path'
import { fileURLToPath } from 'url'
import { createServer, ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ESM import from mjs file
import { createSharedAliases, sharedNodePolyfills } from '../../../vite.shared.config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../..')

describe('Vite Dev Mode Resolution', () => {
  let server: ViteDevServer

  beforeAll(async () => {
    // Create a minimal Vite dev server in middleware mode for resolution testing
    server = await createServer({
      root: path.resolve(projectRoot, 'src/renderer'),
      configFile: false,
      mode: 'development',
      server: {
        middlewareMode: true
      },
      resolve: {
        alias: createSharedAliases(projectRoot)
      },
      plugins: [sharedNodePolyfills(projectRoot)],
      // Disable optimizeDeps to make resolution more predictable in tests
      optimizeDeps: {
        noDiscovery: true,
        include: []
      }
    })
  }, 30000)

  afterAll(async () => {
    await server?.close()
  })

  it('resolves crypto to our ESM shim', async () => {
    const importer = path.resolve(projectRoot, 'src/renderer/index.tsx')
    const resolved = await server.pluginContainer.resolveId('crypto', importer)

    expect(resolved).not.toBeNull()
    expect(resolved?.id).toContain('src/shims/crypto-esm.ts')
  })

  it('resolves randombytes to our ESM shim', async () => {
    const importer = path.resolve(projectRoot, 'src/renderer/index.tsx')
    const resolved = await server.pluginContainer.resolveId('randombytes', importer)

    expect(resolved).not.toBeNull()
    expect(resolved?.id).toContain('src/shims/randombytes-esm.ts')
  })

  it('resolves randomfill to our ESM shim', async () => {
    const importer = path.resolve(projectRoot, 'src/renderer/index.tsx')
    const resolved = await server.pluginContainer.resolveId('randomfill', importer)

    expect(resolved).not.toBeNull()
    expect(resolved?.id).toContain('src/shims/randomfill-esm.ts')
  })

  it('resolves safe-buffer to our ESM shim', async () => {
    const importer = path.resolve(projectRoot, 'src/renderer/index.tsx')
    const resolved = await server.pluginContainer.resolveId('safe-buffer', importer)

    expect(resolved).not.toBeNull()
    expect(resolved?.id).toContain('src/shims/safe-buffer-esm.ts')
  })
})
