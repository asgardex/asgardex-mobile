import { either as E } from 'fp-ts'

import { PoolsStorageEncoded } from '../api/io'
import {
  ApiLang,
  ApiKeystore,
  ApiUrl,
  ApiHDWallet,
  SecureStorageApi,
  SecureStoragePayload,
  UserNodesStorage,
  IPCExportKeystoreParams,
  UserChainStorage,
  UserAssetStorage,
  UserTrustedAddressStorage,
  UserBondProvidersStorage,
  ApiFileStoreService,
  CommonStorage
} from '../api/types'
import { Locale } from '../i18n/types'
import { WalletType } from '../wallet/types'
import { MOCK_KEYSTORE } from './wallet'

const mockSecureStorage: SecureStorageApi = {
  write: async ({ secureKeyId, payload: _payload }): Promise<{ secureKeyId: string; updatedAt: string }> => ({
    secureKeyId: secureKeyId ?? 'mock-secure-key',
    updatedAt: new Date().toISOString()
  }),
  read: async (_secureKeyId: string): Promise<SecureStoragePayload> => ({
    type: 'keystore',
    keystore: MOCK_KEYSTORE
  }),
  remove: async () => Promise.resolve(),
  exists: async () => Promise.resolve({ exists: true, supported: false }),
  list: async () => Promise.resolve([])
}

// Mock "empty" `apiKeystore`
export const apiKeystore: ApiKeystore = {
  saveKeystoreWallets: (_) => Promise.resolve(E.right([])),
  exportKeystore: (_: IPCExportKeystoreParams) => Promise.resolve(),
  load: () => Promise.resolve(MOCK_KEYSTORE),
  initKeystoreWallets: () => Promise.resolve(E.right([])),
  secure: mockSecureStorage
}

// Mock `apiLang`
export const apiLang: ApiLang = {
  update: (_: Locale) => {}
}

// Mock `apiUrl`
export const apiUrl: ApiUrl = {
  openExternal: (url: string) => Promise.resolve(console.log('openExternal called: ', url))
}

// Mock `apiHDWallet`
export const apiHDWallet: ApiHDWallet = {
  getLedgerAddress: ({ chain }) =>
    Promise.resolve(
      E.right({
        chain,
        address: 'ledger_address',
        type: WalletType.Ledger,
        walletAccount: 0,
        walletIndex: 0,
        hdMode: 'default'
      })
    ),
  verifyLedgerAddress: () => Promise.resolve(true),
  sendLedgerTx: () => Promise.resolve(E.right('tx_hash')),
  depositLedgerTx: () => Promise.resolve(E.right('tx_hash')),
  approveLedgerERC20Token: () => Promise.resolve(E.right('tx_hash')),
  saveLedgerAddresses: (_) => Promise.resolve(E.right([])),
  getLedgerAddresses: () => Promise.resolve(E.right([]))
}

const commonStorageData: CommonStorage = {
  locale: Locale.EN,
  evmDerivationMode: 'metamask',
  midgard: {
    mainnet: 'midgard-url-mainnet',
    stagenet: 'midgard-url-stagenet',
    testnet: 'midgard-url-testnet'
  },
  midgardMaya: {
    mainnet: 'midgard-url-mainnet',
    stagenet: 'midgard-url-stagenet',
    testnet: 'midgard-url-testnet'
  },
  thornodeRpc: {
    mainnet: 'thornode-rpc-mainnet',
    stagenet: 'thornode-rpc-stagenet',
    testnet: 'thornode-rpc-testnet'
  },
  thornodeApi: {
    mainnet: 'thornode-api-mainnet',
    stagenet: 'thornode-api-stagenet',
    testnet: 'thornode-api-testnet'
  },
  mayanodeRpc: {
    mainnet: 'mayanode-rpc-mainnet',
    stagenet: 'mayanode-rpc-stagenet',
    testnet: 'mayanode-rpc-testnet'
  },
  mayanodeApi: {
    mainnet: 'mayanode-api-mainnet',
    stagenet: 'mayanode-api-stagenet',
    testnet: 'mayanode-api-testnet'
  },
  version: '1'
}

export const apiCommonStorage: ApiFileStoreService<CommonStorage> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(commonStorageData),
  remove: () => Promise.resolve(console.log('mock remove common storage data')),
  get: () => Promise.resolve(commonStorageData),
  exists: () => Promise.resolve(true)
}

const userNodeStorageData: UserNodesStorage = {
  mainnet: [],
  stagenet: [],
  testnet: [],
  version: '1'
}

export const apiUserNodesStorage: ApiFileStoreService<UserNodesStorage> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(userNodeStorageData),
  remove: () => Promise.resolve(console.log('mock remove user node storage data')),
  get: () => Promise.resolve(userNodeStorageData),
  exists: () => Promise.resolve(true)
}
const userBondProvidersStorageData: UserBondProvidersStorage = {
  mainnet: [],
  stagenet: [],
  testnet: [],
  version: '1'
}

export const apiUserBondProvidersStorage: ApiFileStoreService<UserBondProvidersStorage> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(userBondProvidersStorageData),
  remove: () => Promise.resolve(console.log('mock remove user bond provider storage data')),
  get: () => Promise.resolve(userBondProvidersStorageData),
  exists: () => Promise.resolve(true)
}

const poolsStorageData: PoolsStorageEncoded = {
  watchlists: {
    mainnet: [],
    stagenet: [],
    testnet: []
  },
  version: '1'
}

export const apiPoolsStorage: ApiFileStoreService<PoolsStorageEncoded> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(poolsStorageData),
  remove: () => Promise.resolve(console.log('mock remove pools storage data')),
  get: () => Promise.resolve(poolsStorageData),
  exists: () => Promise.resolve(true)
}

const userChainStorageData: UserChainStorage = {
  chains: [],
  version: '1'
}

export const apiChainStorage: ApiFileStoreService<UserChainStorage> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(userChainStorageData),
  remove: () => Promise.resolve(console.log('mock remove chain storage data')),
  get: () => Promise.resolve(userChainStorageData),
  exists: () => Promise.resolve(true)
}

const userAddressStorageData: UserTrustedAddressStorage = {
  addresses: [],
  version: '1'
}

export const apiAddressStorage: ApiFileStoreService<UserTrustedAddressStorage> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(userAddressStorageData),
  remove: () => Promise.resolve(console.log('mock remove address storage data')),
  get: () => Promise.resolve(userAddressStorageData),
  exists: () => Promise.resolve(true)
}

const userAssetStorageData: UserAssetStorage = {
  assets: [],
  version: '2'
}

export const apiAssetStorage: ApiFileStoreService<UserAssetStorage> = {
  save: (_: Partial<CommonStorage>) => Promise.resolve(userAssetStorageData),
  remove: () => Promise.resolve(console.log('mock remove asset storage data')),
  get: () => Promise.resolve(userAssetStorageData),
  exists: () => Promise.resolve(true)
}
