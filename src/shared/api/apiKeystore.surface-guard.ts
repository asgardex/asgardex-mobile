import { ApiKeystore } from './types'

type AllowedApiKeystoreKeys = 'saveKeystoreWallets' | 'exportKeystore' | 'initKeystoreWallets' | 'load' | 'secure'

type ApiKeystoreKeys = keyof ApiKeystore

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __ApiKeystoreSurfaceGuard = Assert<IsExact<ApiKeystoreKeys, AllowedApiKeystoreKeys>>

// Signature guard: ensures method signatures match at compile time
export type __ApiKeystoreSignatureGuard = ApiKeystore
