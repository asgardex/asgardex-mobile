import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createLogger, __setAppLoggerConsoleLoggingForTests } from './logging'

type PluginInfoFn = (typeof import('@tauri-apps/plugin-log'))['info']
type PluginWarnFn = (typeof import('@tauri-apps/plugin-log'))['warn']
type PluginErrorFn = (typeof import('@tauri-apps/plugin-log'))['error']
type PluginDebugFn = (typeof import('@tauri-apps/plugin-log'))['debug']

const { infoMock, warnMock, errorMock, debugMock } = vi.hoisted(() => {
  const info = vi.fn<PluginInfoFn>()
  const warn = vi.fn<PluginWarnFn>()
  const error = vi.fn<PluginErrorFn>()
  const debug = vi.fn<PluginDebugFn>()
  info.mockResolvedValue(undefined)
  warn.mockResolvedValue(undefined)
  error.mockResolvedValue(undefined)
  debug.mockResolvedValue(undefined)
  return { infoMock: info, warnMock: warn, errorMock: error, debugMock: debug }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: infoMock,
  warn: warnMock,
  error: errorMock,
  debug: debugMock
}))

const setTauriRuntimeAvailable = (enabled: boolean) => {
  const win = globalThis.window as typeof window & { __TAURI__?: unknown }
  if (!win) return
  if (enabled) {
    win.__TAURI__ = win.__TAURI__ ?? {}
  } else {
    delete win.__TAURI__
  }
}

describe('app logging service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __setAppLoggerConsoleLoggingForTests(false)
    setTauriRuntimeAvailable(true)
  })

  afterEach(() => {
    setTauriRuntimeAvailable(false)
    __setAppLoggerConsoleLoggingForTests(null)
  })

  it('delegates scoped info logs to plugin with sanitized context', async () => {
    const logger = createLogger('wallet')
    await logger.info('loaded keystore', { count: 2, nested: { foo: 'bar' }, skip: undefined })

    expect(infoMock).toHaveBeenCalledTimes(1)
    expect(infoMock).toHaveBeenCalledWith('[wallet] loaded keystore', {
      keyValues: { count: '2', nested: '{"foo":"bar"}' }
    })
  })

  it('falls back to console when plugin rejects', async () => {
    warnMock.mockRejectedValueOnce(new Error('offline'))
    const logger = createLogger('keystore')
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await logger.warn('secure storage read failed', { walletId: 'abc' })

    expect(warnMock).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalled()
    const [prefix, message, context, reason] = consoleSpy.mock.calls[0]
    expect(prefix).toBe('[app]')
    expect(message).toBe('[keystore] secure storage read failed')
    expect(context).toContain('walletId')
    expect(reason).toContain('log sink unavailable')
    consoleSpy.mockRestore()
  })

  it('mirrors to console when explicitly enabled', async () => {
    __setAppLoggerConsoleLoggingForTests(true)
    const logger = createLogger('updates')
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    await logger.info('checking for updates')

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()
  })

  it('sends debug logs to the plugin when available', async () => {
    const logger = createLogger('telemetry')
    await logger.debug('sanity check', { event: 'foo' })

    expect(debugMock).toHaveBeenCalledTimes(1)
    expect(debugMock).toHaveBeenCalledWith('[telemetry] sanity check', { keyValues: { event: 'foo' } })
  })
})
