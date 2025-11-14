import { describe, expect, it } from 'vitest'

import { EXTERNALS_WHITELIST, isExternalUrlAllowed, normalizeExternalUrl, parseExternalHostname } from './whitelist'

describe('shared/url/whitelist', () => {
  it('normalizes scheme, hostname and path', () => {
    const url = normalizeExternalUrl(' GitHub.com/asgardex/asgardex-desktop/ ')
    expect(url).not.toBeNull()
    expect(url?.protocol).toBe('https:')
    expect(url?.hostname).toBe('github.com')
    expect(url?.pathname).toBe('/asgardex/asgardex-desktop/')
  })

  it('parses hostname for allowed URLs', () => {
    const hostname = parseExternalHostname('https://github.com/asgardex')
    expect(hostname).toBe('github.com')
  })

  it('rejects invalid or unsupported URLs', () => {
    expect(normalizeExternalUrl('')).toBeNull()
    expect(normalizeExternalUrl('ftp://github.com/asgardex')).toBeNull()
    expect(normalizeExternalUrl('https://user:pass@github.com/asgardex')).toBeNull()
  })

  it('checks whitelist using normalized hostname', () => {
    const allowedHost = EXTERNALS_WHITELIST[0]
    expect(isExternalUrlAllowed(`https://${allowedHost}`)).toBe(true)
    expect(isExternalUrlAllowed('https://not-allowed.example.com')).toBe(false)
  })
})
