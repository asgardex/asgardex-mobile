import { isError } from './guard'

export const safeStringify = (value: unknown): string => {
  try {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value)
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value)
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  } catch (error) {
    const normalized = isError(error) ? error : Error(String(error))
    return `[unserializable:${normalized.message}]`
  }
}
