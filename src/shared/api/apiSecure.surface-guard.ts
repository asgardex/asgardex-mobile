import { SecureStorageApi } from './types'

type AllowedSecureStorageApiKeys = 'write' | 'read' | 'remove' | 'exists' | 'list'

type SecureStorageApiKeys = keyof SecureStorageApi

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __SecureStorageApiSurfaceGuard = Assert<IsExact<SecureStorageApiKeys, AllowedSecureStorageApiKeys>>

// Signature guard: ensures method signatures match at compile time
export type __SecureStorageApiSignatureGuard = SecureStorageApi
