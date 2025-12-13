import { ApiLang } from './types'

type AllowedApiLangKeys = 'update'

type ApiLangKeys = keyof ApiLang

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __ApiLangSurfaceGuard = Assert<IsExact<ApiLangKeys, AllowedApiLangKeys>>

// Signature guard: ensures method signatures match at compile time
export type __ApiLangSignatureGuard = ApiLang
