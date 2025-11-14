import { getDeviceInfo } from '../../../shared/utils/platform'

export type NotificationPlatform = 'android' | 'ios' | 'desktop'

const detectMobileOs = (): 'android' | 'ios' | 'unknown' => {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent ?? ''
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'unknown'
}

export const resolveNotificationPlatform = (): NotificationPlatform => {
  const device = getDeviceInfo()
  if (!device.isMobile) return 'desktop'
  const os = detectMobileOs()
  if (os === 'android') return 'android'
  if (os === 'ios') return 'ios'
  return 'desktop'
}

export const resolveExportSuccessMessageId = (): string => {
  const platform = resolveNotificationPlatform()
  if (platform === 'android') return 'settings.export.success.android'
  if (platform === 'ios') return 'settings.export.success.ios'
  return 'settings.export.success.desktop'
}
