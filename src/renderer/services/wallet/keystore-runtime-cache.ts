import { Keystore } from '@xchainjs/xchain-crypto'

import { KeystoreId } from '../../../shared/api/types'
import { isTauri } from '../../../shared/utils/platform'

const runtimeKeystoreCacheMap = new Map<KeystoreId, Keystore>()

const RUNTIME_CACHE_IDLE_MS = 2 * 60 * 1000

let runtimeCacheIdleTimer: ReturnType<typeof setTimeout> | null = null
let tauriFocusUnlisten: (() => void) | null = null
let windowUnloadCleanupRegistered = false
let visibilityHandlersRegistered = false

const cleanupTauriFocusListener = () => {
  if (!tauriFocusUnlisten) return
  try {
    tauriFocusUnlisten()
  } catch {
    // ignore cleanup failures
  }
  tauriFocusUnlisten = null
}

const clearRuntimeCacheIdleTimer = () => {
  if (!runtimeCacheIdleTimer) return
  clearTimeout(runtimeCacheIdleTimer)
  runtimeCacheIdleTimer = null
}

const clearAllRuntimeCache = () => {
  clearRuntimeCacheIdleTimer()
  if (runtimeKeystoreCacheMap.size > 0) {
    runtimeKeystoreCacheMap.clear()
  }
}

const scheduleRuntimeCacheIdleClear = () => {
  clearRuntimeCacheIdleTimer()
  runtimeCacheIdleTimer = setTimeout(() => {
    runtimeCacheIdleTimer = null
    clearAllRuntimeCache()
  }, RUNTIME_CACHE_IDLE_MS)
}

const handleVisibilityChange = () => {
  if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') {
    cleanupTauriFocusListener()
    clearAllRuntimeCache()
  }
}

const ensureLifecycleHandlers = () => {
  if (visibilityHandlersRegistered) return
  visibilityHandlersRegistered = true

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  if (isTauri()) {
    void import('@tauri-apps/api/window')
      .then(async ({ getCurrentWindow }) => {
        try {
          const appWindow = getCurrentWindow()
          const unlisten = await appWindow.onFocusChanged(({ payload: focused }) => {
            if (!focused) {
              clearAllRuntimeCache()
            }
          })
          tauriFocusUnlisten = () => {
            try {
              unlisten()
            } catch {
              // ignore unlisten errors
            }
            tauriFocusUnlisten = null
          }
          if (!windowUnloadCleanupRegistered && typeof window.addEventListener === 'function') {
            window.addEventListener('beforeunload', cleanupTauriFocusListener, { once: true })
            windowUnloadCleanupRegistered = true
          }
        } catch {
          // Ignore focus subscription failures; visibility handlers remain active.
        }
      })
      .catch(() => {
        // Ignore dynamic import failures; visibility handlers remain opt-in.
      })
  }
}

export const runtimeKeystoreCache = {
  get: (id: KeystoreId): Keystore | undefined => runtimeKeystoreCacheMap.get(id),
  set: (id: KeystoreId, keystore: Keystore): void => {
    runtimeKeystoreCacheMap.set(id, keystore)
    scheduleRuntimeCacheIdleClear()
  },
  delete: (id: KeystoreId): void => {
    runtimeKeystoreCacheMap.delete(id)
  },
  clearAll: (): void => {
    clearAllRuntimeCache()
  },
  prune: (allowedIds: Set<KeystoreId>): void => {
    Array.from(runtimeKeystoreCacheMap.keys()).forEach((key) => {
      if (!allowedIds.has(key)) runtimeKeystoreCacheMap.delete(key)
    })
  },
  ensureLifecycleHandlers
}

export const __internalRuntimeCacheHelpers = {
  RUNTIME_CACHE_IDLE_MS,
  handleVisibilityChange,
  resetForTests: () => {
    cleanupTauriFocusListener()
    clearAllRuntimeCache()

    if (
      visibilityHandlersRegistered &&
      typeof document !== 'undefined' &&
      typeof document.removeEventListener === 'function'
    ) {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    runtimeCacheIdleTimer = null
    tauriFocusUnlisten = null
    windowUnloadCleanupRegistered = false
    visibilityHandlersRegistered = false
  }
}
