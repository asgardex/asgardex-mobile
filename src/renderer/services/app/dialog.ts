export const confirmDialog = async (message: string): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true
  }
  try {
    return window.confirm(message)
  } catch {
    return true
  }
}

export const alertDialog = async (message: string): Promise<void> => {
  if (typeof window === 'undefined' || typeof window.alert !== 'function') {
    return
  }
  try {
    window.alert(message)
  } catch {
    // Swallow alert errors; nothing meaningful to surface.
  }
}
