export const EXTERNALS_WHITELIST = [
  'thorchain.net',
  'testnet.thorchain.net',
  'docs.thorchain.org',
  'dev.thorchain.org',
  'docs.mayaprotocol.com',
  'discord.gg',
  'twitter.com',
  'x.com',
  'github.com',
  'explorer.binance.org',
  'testnet-explorer.binance.org',
  'blockstream.info',
  'dex.binance.org',
  'testnet-dex.binance.org',
  'thoryield.com',
  'app.thoryield.com',
  'etherscan.io',
  'ropsten.etherscan.io',
  'tltc.bitaps.com',
  'ltc.bitaps.com',
  'www.blockchain.com',
  'api.blockcypher.com',
  'blockchair.com',
  'blockexplorer.one',
  'testnet.thorswap.finance',
  'stagenet.thorswap.finance',
  'app.thorswap.finance',
  'viewblock.io',
  'runescan.io',
  'scan.chainflip.io',
  'testnet.midgard.thorchain.info',
  'stagenet-midgard.ninerealms.com',
  'testnet-rpc.ninerealms.com',
  'stagenet-rpc.ninerealms.com',
  'rpc.ninerealms.com',
  'mayanode.mayachain.info',
  'testnet.thornode.thorchain.info',
  'stagenet-thornode.ninerealms.com',
  'stagenet-rpc.ninerealms.com',
  'www.mintscan.io',
  'explorer.theta-testnet.polypore.xyz',
  'snowtrace.dev',
  'routescan.io',
  'bscscan.com',
  'track.ninerealms.com',
  'www.xscanner.org',
  'mayascan.org',
  'www.mayascan.org',
  'explorer.mayachain.info',
  'insight.dash.org',
  'finder.kujira.network',
  'midgard.ninerealms.com',
  'midgard.mayachain.com',
  'asgardex.com',
  'arbiscan.io',
  'mainnet.radixdlt.com',
  'dashboard.radixdlt.com',
  'explorer.solana.com',
  'adastat.net',
  'tronscan.org'
] as const

export type ExternalWhitelistHost = (typeof EXTERNALS_WHITELIST)[number]

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

const canonicalizeHostname = (value: string): string => value.trim().toLowerCase().replace(/\.+$/, '')

const ensureDefaultScheme = (target: string): string => (HAS_SCHEME.test(target) ? target : `https://${target}`)

const resolveEnvMode = (): string => {
  try {
    const mode = (import.meta as unknown as { env?: { MODE?: string } } | undefined)?.env?.MODE
    if (typeof mode === 'string') return mode
  } catch (_error) {
    // ignore access errors and fall back to NODE_ENV
  }
  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
    return process.env.NODE_ENV
  }
  return 'production'
}

export const isWhitelistedExternalHost = (hostname: string): hostname is ExternalWhitelistHost => {
  const normalized = canonicalizeHostname(hostname)
  return EXTERNALS_WHITELIST.includes(normalized as ExternalWhitelistHost)
}

export const normalizeExternalUrl = (target: string): URL | null => {
  const trimmed = target?.trim()
  if (!trimmed) return null

  try {
    const url = new URL(ensureDefaultScheme(trimmed))

    const envMode = resolveEnvMode()
    const protocol = url.protocol
    const isHttps = protocol === 'https:'
    const isHttp = protocol === 'http:'
    const isDevLike = envMode !== 'production'
    if (!(isHttps || (isHttp && isDevLike))) return null

    if (url.username || url.password) return null

    const hostname = canonicalizeHostname(url.hostname)
    if (!hostname) return null
    url.hostname = hostname

    return url
  } catch (_error) {
    return null
  }
}

export const parseExternalHostname = (target: string): string | null => normalizeExternalUrl(target)?.hostname ?? null

export const isExternalUrlAllowed = (target: string): boolean => {
  const normalized = normalizeExternalUrl(target)
  return normalized ? isWhitelistedExternalHost(normalized.hostname) : false
}
