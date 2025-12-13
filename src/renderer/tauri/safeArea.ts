import { invoke } from '@tauri-apps/api/core'

export type SafeAreaInsets = {
  top: number
  bottom: number
  left: number
  right: number
}

export type SafeAreaFetcher = () => Promise<SafeAreaInsets>

type MaybeWindow = Window & { __TAURI_IPC__?: unknown }

const ZERO_INSETS: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 }
const SAFE_AREA_KEYS: Array<keyof SafeAreaInsets> = ['top', 'bottom', 'left', 'right']

const hasTauriBridge = (): boolean => {
  const win = typeof window === 'undefined' ? undefined : (window as MaybeWindow)
  return Boolean(win && win.__TAURI_IPC__)
}

const normalizeInsets = (value: unknown): SafeAreaInsets => {
  if (!value || typeof value !== 'object') return ZERO_INSETS
  const partial = value as Partial<Record<keyof SafeAreaInsets, unknown>>
  return {
    top: Number(partial.top) || 0,
    bottom: Number(partial.bottom) || 0,
    left: Number(partial.left) || 0,
    right: Number(partial.right) || 0
  }
}

const invokeFetcher: SafeAreaFetcher = async () => {
  if (!hasTauriBridge()) return ZERO_INSETS

  try {
    const insets = await invoke<SafeAreaInsets>('plugin:safe-area-insets|get_insets')
    return normalizeInsets(insets)
  } catch (_error) {
    return ZERO_INSETS
  }
}

let cachedFetcherPromise: Promise<SafeAreaFetcher> | undefined

const resolveFetcher = (): Promise<SafeAreaFetcher> => {
  if (!cachedFetcherPromise) {
    cachedFetcherPromise = (async () => {
      try {
        const plugin = await import('tauri-plugin-safe-area-insets')
        if (plugin && typeof plugin.getInsets === 'function') {
          return async () => {
            if (!hasTauriBridge()) return ZERO_INSETS
            try {
              return normalizeInsets(await plugin.getInsets())
            } catch (_error) {
              return ZERO_INSETS
            }
          }
        }
      } catch (_error) {
        // fall through to invoke-based fetcher
      }
      return invokeFetcher
    })()
  }
  return cachedFetcherPromise
}

export const getInsets: SafeAreaFetcher = async () => {
  const fetcher = await resolveFetcher()
  return fetcher()
}

const formatPx = (value: number): string => `${Math.max(0, Math.round(value))}px`

const getInsetsSafely = async (fetchInsets: SafeAreaFetcher): Promise<SafeAreaInsets> => {
  try {
    return normalizeInsets(await fetchInsets())
  } catch (_error) {
    return ZERO_INSETS
  }
}

export const applySafeAreaVars = async (fetchInsets: SafeAreaFetcher): Promise<void> => {
  const doc = typeof document === 'undefined' ? undefined : document
  if (!doc) return

  const root = doc.documentElement
  const insets = await getInsetsSafely(fetchInsets)

  SAFE_AREA_KEYS.forEach((key) => {
    root.style.setProperty(`--safe-area-${key}`, formatPx(insets[key]))
  })
}

let teardown: (() => void) | undefined

export const watchSafeArea = (fetchInsets: SafeAreaFetcher): (() => void) => {
  const win = typeof window === 'undefined' ? undefined : window
  const doc = typeof document === 'undefined' ? undefined : document
  if (!win || !doc) return () => undefined

  teardown?.()

  const scheduleApply = () => {
    void applySafeAreaVars(fetchInsets)
  }

  const handleVisibility = () => {
    if (!doc.hidden) {
      scheduleApply()
    }
  }

  win.addEventListener('resize', scheduleApply)
  win.addEventListener('orientationchange', scheduleApply)
  doc.addEventListener('visibilitychange', handleVisibility)

  scheduleApply()

  const cleanup = () => {
    win.removeEventListener('resize', scheduleApply)
    win.removeEventListener('orientationchange', scheduleApply)
    doc.removeEventListener('visibilitychange', handleVisibility)
    teardown = undefined
  }

  teardown = cleanup
  return cleanup
}
