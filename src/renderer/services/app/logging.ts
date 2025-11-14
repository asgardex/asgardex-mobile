import { info as pluginInfo, warn as pluginWarn, error as pluginError } from '@tauri-apps/plugin-log'

import { safeStringify } from '../../../shared/utils/safeStringify'
import { isError } from '../../../shared/utils/guard'

type LoggerContext = Record<string, unknown>
type NormalizedContext = Record<string, string>
type LogLevel = 'info' | 'warn' | 'error'

type LoggerMethod = (message: string, context?: LoggerContext) => Promise<void>

export type Logger = {
  info: LoggerMethod
  warn: LoggerMethod
  error: LoggerMethod
}

const PLUGIN_LOGGERS: Record<LogLevel, typeof pluginInfo> = {
  info: pluginInfo,
  warn: pluginWarn,
  error: pluginError
}

const LOG_PREFIX = '[app]'

let consoleLoggingOverride: boolean | null = null

export const __setAppLoggerConsoleLoggingForTests = (override: boolean | null): void => {
  consoleLoggingOverride = typeof override === 'boolean' ? override : null
}

const isTestEnv = (): boolean => {
  try {
    const envMode = (import.meta as unknown as { env?: { MODE?: string } } | undefined)?.env?.MODE
    if (envMode === 'test') return true
  } catch (_) {
    // no-op
  }

  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
}

const readEnvFlag = (key: string): string | undefined => {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> } | undefined)?.env
    if (metaEnv && typeof metaEnv[key] === 'string') return metaEnv[key]
  } catch (_) {
    // Ignore – import.meta not available (e.g., tests)
  }

  if (typeof process !== 'undefined') {
    const envValue = process.env?.[key]
    if (typeof envValue === 'string') return envValue
  }

  return undefined
}

const isConsoleFlagEnabled = (): boolean => {
  const rawValue = readEnvFlag('VITE_TAURI_FORCE_LOG_TO_CONSOLE') ?? readEnvFlag('ASGARDEX_FORCE_LOG_TO_CONSOLE')
  if (!rawValue) return false

  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(rawValue)
}

const shouldMirrorToConsole = (): boolean => {
  if (consoleLoggingOverride !== null) return consoleLoggingOverride
  return isTestEnv() || isConsoleFlagEnabled()
}

const isTauriRuntimeAvailable = (): boolean => {
  if (typeof window === 'undefined') return false
  return Boolean((window as typeof window & { __TAURI__?: unknown }).__TAURI__)
}

const safeStringifyContext = (value: unknown): string | undefined => {
  try {
    return safeStringify(value)
  } catch (_error) {
    return undefined
  }
}

const normalizeContextValue = (value: unknown): string | undefined => {
  if (value === undefined) return undefined
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    return value.toString()
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Error) return value.message
  if (typeof value === 'object') {
    return safeStringifyContext(value)
  }
  return undefined
}

const normalizeContext = (context?: LoggerContext): NormalizedContext | undefined => {
  if (!context) return undefined

  const normalizedEntries = Object.entries(context).reduce<NormalizedContext>((acc, [key, value]) => {
    if (!key) return acc
    const normalizedValue = normalizeContextValue(value)
    if (normalizedValue !== undefined) {
      acc[key] = normalizedValue
    }
    return acc
  }, {})

  return Object.keys(normalizedEntries).length > 0 ? normalizedEntries : undefined
}

const resolveConsoleMethod = (level: LogLevel): 'error' | 'warn' | 'info' => {
  if (level === 'error') return 'error'
  if (level === 'warn') return 'warn'
  return 'info'
}

const emitConsoleLog = (level: LogLevel, message: string, context?: NormalizedContext, reason?: string): void => {
  if (typeof console === 'undefined') return
  const method = resolveConsoleMethod(level)
  const consoleMethod = console[method]
  if (typeof consoleMethod !== 'function') return

  const payload: string[] = [LOG_PREFIX, message]
  if (context) {
    const serializedContext = safeStringifyContext(context)
    if (serializedContext) {
      payload.push(serializedContext)
    }
  }
  if (reason) {
    payload.push(`(${reason})`)
  }

  consoleMethod(...payload)
}

const callPluginLogger = async (
  level: LogLevel,
  message: string,
  context?: NormalizedContext
): Promise<{ success: boolean; error?: Error }> => {
  if (!isTauriRuntimeAvailable()) {
    return { success: false, error: new Error('tauri runtime unavailable') }
  }

  const logFn = PLUGIN_LOGGERS[level]
  if (!logFn) {
    return { success: false, error: new Error('log function missing') }
  }

  try {
    await logFn(message, context ? { keyValues: context } : undefined)
    return { success: true }
  } catch (error) {
    return { success: false, error: isError(error) ? error : new Error(String(error)) }
  }
}

const logInternal = async (
  level: LogLevel,
  scope: string | undefined,
  message: string,
  context?: LoggerContext
): Promise<void> => {
  const normalizedContext = normalizeContext(context)
  const scopedMessage = scope ? `[${scope}] ${message}` : message
  const mirrorToConsole = shouldMirrorToConsole()

  if (mirrorToConsole) {
    emitConsoleLog(level, scopedMessage, normalizedContext)
  }

  const result = await callPluginLogger(level, scopedMessage, normalizedContext)
  if (!result.success && !mirrorToConsole) {
    const reason = result.error ? `log sink unavailable: ${result.error.message}` : 'log sink unavailable'
    emitConsoleLog(level, scopedMessage, normalizedContext, reason)
  }
}

export const createLogger = (scope?: string): Logger => {
  const trimmedScope = scope?.trim() || undefined

  return {
    info: (message: string, context?: LoggerContext) => logInternal('info', trimmedScope, message, context),
    warn: (message: string, context?: LoggerContext) => logInternal('warn', trimmedScope, message, context),
    error: (message: string, context?: LoggerContext) => logInternal('error', trimmedScope, message, context)
  }
}

export const appLogger = createLogger('app')
