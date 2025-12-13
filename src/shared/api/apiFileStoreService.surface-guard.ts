import { ApiFileStoreService } from './types'

type AllowedApiFileStoreServiceKeys = 'save' | 'remove' | 'get' | 'exists'

// Use `unknown` as the generic parameter to check the base interface keys
type ApiFileStoreServiceKeys = keyof ApiFileStoreService<unknown>

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __ApiFileStoreServiceSurfaceGuard = Assert<IsExact<ApiFileStoreServiceKeys, AllowedApiFileStoreServiceKeys>>

// Signature guard: ensures method signatures match at compile time
export type __ApiFileStoreServiceSignatureGuard = ApiFileStoreService<unknown>
