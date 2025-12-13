import { ApiHDWallet } from './types'

type AllowedApiHDWalletKeys =
  | 'getLedgerAddress'
  | 'verifyLedgerAddress'
  | 'sendLedgerTx'
  | 'depositLedgerTx'
  | 'approveLedgerERC20Token'
  | 'saveLedgerAddresses'
  | 'getLedgerAddresses'

type ApiHDWalletKeys = keyof ApiHDWallet

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Assert<T extends true> = T

// Compile-time guard: update intentionally if upstream expands the surface.
export type __ApiHDWalletSurfaceGuard = Assert<IsExact<ApiHDWalletKeys, AllowedApiHDWalletKeys>>

// Signature guard: ensures method signatures match at compile time
export type __ApiHDWalletSignatureGuard = ApiHDWallet
