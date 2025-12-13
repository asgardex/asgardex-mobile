import './index.css'
import './safe-area.css'
import { createRoot } from 'react-dom/client'

import { getInsets as getSafeAreaInsets, watchSafeArea } from './tauri/safeArea'

/**
 * CRITICAL: Bootstrap Ordering Invariant
 *
 * windowApi.ts MUST be imported BEFORE App (and all service modules).
 *
 * The windowApi module attaches the window.api* surface (apiKeystore, apiSecure,
 * apiUrl, apiHDWallet, storage APIs, etc.) that services depend on. If App is
 * imported first, service modules will encounter undefined window.api* properties,
 * causing runtime crashes.
 *
 * This ordering is enforced by:
 * 1. Dynamic imports with explicit await (this file)
 * 2. Tests in bootstrap-ordering.test.ts that validate the invariant
 * 3. rebase.test.ts which checks this file contains the required pattern
 *
 * @see src/renderer/tauri/windowApi.ts - attaches window.api* surface
 * @see src/renderer/tauri/bootstrap-ordering.test.ts - invariant tests
 */
async function bootstrap() {
  // Step 1: Initialize window.api* surface (MUST be first)
  await import('./tauri/windowApi')

  // Step 2: Import App (services can now safely access window.api*)
  const { App } = await import('./App')

  void watchSafeArea(getSafeAreaInsets)

  const container = document.getElementById('root')
  if (!container) {
    throw new Error('[BOOT] root container "#root" not found')
  }

  const root = createRoot(container)
  root.render(<App />)
}

bootstrap().catch((error) => {
  // Keep a minimal error log for release diagnostics.
  console.error('[BOOT] bootstrap failed', error)
})
