import { ApiUrl } from './types'

type AllowedApiUrlKeys = 'openExternal'

type ApiUrlKeys = keyof ApiUrl

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __ApiUrlSurfaceGuard = Assert<IsExact<ApiUrlKeys, AllowedApiUrlKeys>>

// Signature guard: ensures method signatures match at compile time
export type __ApiUrlSignatureGuard = ApiUrl
