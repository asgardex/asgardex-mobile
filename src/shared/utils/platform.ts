/**
 * Platform detection utilities
 *
 * This is a minimal port of the Tauri branch helpers. It is intentionally
 * self-contained so that tauri can share the same device heuristics without
 * reintroducing a renderer-level platform facade.
 */

export type DeviceType = 'mobile' | 'desktop' | 'unknown'

export type DeviceDetectionSource = 'env' | 'ua' | 'platform' | 'default'

export type DeviceInfo = {
  type: DeviceType
  isMobile: boolean
  source: DeviceDetectionSource
}

const MOBILE_UA_REGEX = /Android|iPhone|iPad|iPod|Mobile/i

const computeUaDevice = (): DeviceInfo | null => {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  if (MOBILE_UA_REGEX.test(ua)) {
    return {
      type: 'mobile',
      isMobile: true,
      source: 'ua'
    }
  }
  return null
}

const DEFAULT_DEVICE: DeviceInfo = {
  type: 'desktop',
  isMobile: false,
  source: 'default'
}

let platformOverride: DeviceInfo | null = null

const computeDevice = (): DeviceInfo => {
  if (platformOverride) {
    return platformOverride
  }

  return computeUaDevice() ?? DEFAULT_DEVICE
}

const syncDocumentPlatformDataset = (): void => {
  if (typeof document === 'undefined' || !document?.documentElement) return
  const root = document.documentElement
  root.dataset.platform = currentDevice.isMobile ? 'mobile' : 'desktop'
}

let currentDevice: DeviceInfo = computeDevice()
syncDocumentPlatformDataset()

export let isMobile = currentDevice.isMobile

export const getDeviceInfo = (): DeviceInfo => currentDevice

/**
 * Allows platform integrations (Tauri, Electron, Web harness) to override the
 * detected device type. This ensures we do not rely solely on user agent hints.
 */
export const setPlatformDevice = (info: Partial<DeviceInfo> | null): void => {
  if (info) {
    const previous = currentDevice
    const explicitMobile = typeof info.isMobile === 'boolean' ? info.isMobile : undefined

    const type: DeviceType =
      info.type ?? (explicitMobile !== undefined ? (explicitMobile ? 'mobile' : 'desktop') : 'unknown')

    const next: DeviceInfo = {
      type,
      isMobile:
        explicitMobile !== undefined
          ? explicitMobile
          : type === 'mobile'
            ? true
            : type === 'desktop'
              ? false
              : previous.isMobile,
      source: info.source ?? 'platform'
    }
    platformOverride = next
  } else {
    platformOverride = null
  }

  currentDevice = computeDevice()
  isMobile = currentDevice.isMobile
  syncDocumentPlatformDataset()
}

/**
 * Test helper: clears platform overrides so subsequent calls recompute from env/UA.
 */
export const resetPlatformDeviceForTests = (): void => {
  platformOverride = null
  currentDevice = computeDevice()
  isMobile = currentDevice.isMobile
  syncDocumentPlatformDataset()
}

/**
 * Returns true if running in a Tauri environment.
 * Safe to call in SSR/test/node contexts (returns false).
 */
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window
}
