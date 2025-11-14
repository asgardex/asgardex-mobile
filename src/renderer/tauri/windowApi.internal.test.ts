import { describe, expect, it, vi } from 'vitest'

// Mock Tauri modules used by windowApi so the file can be imported in tests.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(),
  dirname: vi.fn(),
  appDataDir: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { Document: 'document' },
  exists: vi.fn(),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn()
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn()
}))

vi.mock('tauri-plugin-secure-storage', () => ({
  secureStorage: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    keys: vi.fn()
  }
}))

import { __internalWindowApiHelpers } from './windowApi'

const { selectSinglePath, ensureJsonExtension } = __internalWindowApiHelpers

describe('windowApi internal helpers', () => {
  describe('selectSinglePath', () => {
    it('returns first entry from array selection', () => {
      expect(selectSinglePath(['a', 'b'])).toBe('a')
      expect(selectSinglePath([])).toBeNull()
    })

    it('returns path from object selection', () => {
      expect(selectSinglePath({ path: '/tmp/file.json' })).toBe('/tmp/file.json')
      expect(selectSinglePath({ filePath: '/tmp/other.json' })).toBe('/tmp/other.json')
      expect(selectSinglePath({ uri: '/tmp/from-uri.json' })).toBe('/tmp/from-uri.json')
    })

    it('returns string selection as-is', () => {
      expect(selectSinglePath('/tmp/single.json')).toBe('/tmp/single.json')
    })

    it('returns null for null/unknown selection', () => {
      expect(selectSinglePath(null)).toBeNull()
      expect(selectSinglePath({})).toBeNull()
    })
  })

  describe('ensureJsonExtension', () => {
    it('keeps .json extension if already present (case-insensitive)', () => {
      expect(ensureJsonExtension('file.json')).toBe('file.json')
      expect(ensureJsonExtension('FILE.JSON')).toBe('FILE.JSON')
    })

    it('appends .json when missing', () => {
      expect(ensureJsonExtension('file')).toBe('file.json')
      expect(ensureJsonExtension('/tmp/file')).toBe('/tmp/file.json')
    })
  })
})
