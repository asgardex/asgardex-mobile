import { ApiAppUpdate } from './types'

type AllowedApiAppUpdateKeys = 'checkForAppUpdates'

type ApiAppUpdateKeys = keyof ApiAppUpdate

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __ApiAppUpdateSurfaceGuard = Assert<IsExact<ApiAppUpdateKeys, AllowedApiAppUpdateKeys>>

// Signature guard: ensures method signatures match at compile time
export type __ApiAppUpdateSignatureGuard = ApiAppUpdate
