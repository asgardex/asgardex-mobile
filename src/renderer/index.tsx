import './index.css'
import './safe-area.css'
import { createRoot } from 'react-dom/client'

import { getInsets as getSafeAreaInsets, watchSafeArea } from './tauri/safeArea'

// Bootstrap ordering matters on mobile:
// windowApi must attach window.api* before any app modules touch storage/services.
async function bootstrap() {
  await import('./tauri/windowApi')
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
