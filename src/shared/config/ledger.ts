import { getDeviceInfo } from '../utils/platform'

const LEDGER_ENABLED_DEFAULT_DESKTOP = 'true'
const LEDGER_ENABLED_DEFAULT_MOBILE = 'false'

const normalizeFlag = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'false') return normalized
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return null
}

const resolveLedgerFlag = (): string => {
  const envValue = normalizeFlag(import.meta.env?.VITE_LEDGER_ENABLED)
  if (envValue) return envValue

  const nodeValue = normalizeFlag(typeof process !== 'undefined' ? process.env?.VITE_LEDGER_ENABLED : undefined)
  if (nodeValue) return nodeValue

  const device = getDeviceInfo()
  return device.isMobile ? LEDGER_ENABLED_DEFAULT_MOBILE : LEDGER_ENABLED_DEFAULT_DESKTOP
}

export const isLedgerUiEnabled = (): boolean => resolveLedgerFlag() === 'true'

export const getLedgerFlag = (): string => resolveLedgerFlag()
