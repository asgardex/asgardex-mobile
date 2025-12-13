export const openExternalUrl = async (target: string): Promise<void> => {
  const trimmed = target?.trim()
  if (!trimmed) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[external] Ignoring empty external URL')
    }
    return
  }

  try {
    await window.apiUrl.openExternal(trimmed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[external] Failed to open external URL "${trimmed}": ${message}`)
    }
  }
}
