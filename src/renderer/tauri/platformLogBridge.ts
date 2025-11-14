import {
  debug as pluginDebug,
  error as pluginError,
  info as pluginInfo,
  trace as pluginTrace,
  warn as pluginWarn
} from '@tauri-apps/plugin-log'

import { safeStringify } from '../../shared/utils/safeStringify'
import { isError } from '../../shared/utils/guard'

type ConsoleMethod = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'log'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

type ConsoleSnapshot = Partial<Record<ConsoleMethod, (...args: unknown[]) => void>>

type WindowWithBridge = typeof window & {
  __TAURI__?: unknown
  __ASGARDEX_PLATFORM_LOG_BRIDGE__?: boolean
  __ASGARDEX_USE_PLATFORM_LOG__?: string
}

const pluginLoggers: Record<LogLevel, (message: string) => Promise<void>> = {
  trace: pluginTrace,
  debug: pluginDebug,
  info: pluginInfo,
  warn: pluginWarn,
  error: pluginError
}

const TRUTHY_FLAGS = new Set(['1', 'true', 'yes', 'on'])
const FALSY_FLAGS = new Set(['0', 'false', 'no', 'off'])

const parseFlag = (value?: string): boolean | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (TRUTHY_FLAGS.has(normalized)) return true
  if (FALSY_FLAGS.has(normalized)) return false
  return undefined
}

const readEnvValue = (key: string): string | undefined => {
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string | undefined> } | undefined)?.env
    if (meta && typeof meta[key] === 'string') return meta[key]
  } catch (error) {
    console.warn('[platform-log]', `Failed to read env value for ${key}`, error)
  }
  return undefined
}

const shouldEnableBridge = (): boolean => {
  if (typeof window === 'undefined') return false
  const w = window as WindowWithBridge
  if (!w.__TAURI__) return false

  const explicitFlag = parseFlag(readEnvValue('VITE_USE_PLATFORM_LOG') ?? readEnvValue('ASGARDEX_USE_PLATFORM_LOG'))
  if (explicitFlag !== undefined) return explicitFlag

  const runtimeFlag = parseFlag(w.__ASGARDEX_USE_PLATFORM_LOG__)
  if (runtimeFlag !== undefined) return runtimeFlag

  const mode = readEnvValue('MODE') ?? (import.meta as unknown as { env?: { MODE?: string } } | undefined)?.env?.MODE
  if (mode === 'production') return true

  // Default to enabled on Tauri builds unless explicitly disabled
  return true
}

const formatArg = (arg: unknown): string => {
  if (arg === null) return 'null'
  if (arg === undefined) return 'undefined'
  if (typeof arg === 'string') return arg
  if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') return String(arg)
  if (arg instanceof Error) {
    const stack = arg.stack ? `\n${arg.stack}` : ''
    return `${arg.message}${stack}`
  }
  if (typeof arg === 'object') {
    try {
      return safeStringify(arg)
    } catch (_) {
      return '[unserializable]'
    }
  }
  return String(arg)
}

const buildMessage = (args: unknown[]): string => args.map((arg) => formatArg(arg)).join(' ')

let installed = false
let snapshot: ConsoleSnapshot | null = null

const wrapMethod = (method: ConsoleMethod, level: LogLevel) => {
  const original = snapshot?.[method] ?? (() => undefined)
  const consoleWithIndex = console as Console & Record<ConsoleMethod, (...args: unknown[]) => void>
  consoleWithIndex[method] = (...args: unknown[]) => {
    const message = buildMessage(args)
    pluginLoggers[level](message).catch((error) => {
      original(...args)
      const reason = isError(error) ? error.message : String(error)
      snapshot?.error?.('[platform-log] Failed to forward console log', reason)
    })
  }
}

export const installPlatformLogBridge = (): boolean => {
  if (installed) return true
  if (!shouldEnableBridge()) return false

  snapshot = {
    trace: console.trace.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console)
  }

  wrapMethod('trace', 'trace')
  wrapMethod('debug', 'debug')
  wrapMethod('info', 'info')
  wrapMethod('warn', 'warn')
  wrapMethod('error', 'error')
  wrapMethod('log', 'info')

  const w = window as WindowWithBridge
  w.__ASGARDEX_PLATFORM_LOG_BRIDGE__ = true
  installed = true

  // Emit a bootstrap message through the plugin sink so android:tail sees activity immediately
  void pluginInfo('[platform-log] console forwarding enabled')
  return true
}

export const isPlatformLogBridgeActive = (): boolean => {
  if (installed) return true
  if (typeof window === 'undefined') return false
  return Boolean((window as WindowWithBridge).__ASGARDEX_PLATFORM_LOG_BRIDGE__)
}
