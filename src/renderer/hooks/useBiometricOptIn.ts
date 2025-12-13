import { useState, useEffect } from 'react'

import { useBiometryStatus } from './useBiometryStatus'

export const useBiometricOptIn = () => {
  const [enabled, setEnabled] = useState(false)
  const { isSupported, isChecking } = useBiometryStatus()

  useEffect(() => {
    if (!isSupported && enabled) {
      setEnabled(false)
    }
  }, [isSupported, enabled])

  return {
    enabled,
    setEnabled,
    isSupported,
    isChecking,
    value: isSupported ? enabled : undefined
  }
}
