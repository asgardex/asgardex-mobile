import { Meta, StoryObj } from '@storybook/react'
import { Fees, FeeType, Network, TxHash } from '@xchainjs/xchain-client'
import { ETH_GAS_ASSET_DECIMAL as ETH_DECIMAL } from '@xchainjs/xchain-ethereum'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'

import { getMockRDValueFactory, RDStatus } from '../../../../../shared/mock/rdByStatus'
import { mockValidatePassword$ } from '../../../../../shared/mock/wallet'
import { AssetETH, AssetBTC, AssetATOM } from '../../../../../shared/utils/asset'
import { WalletType } from '../../../../../shared/wallet/types'
import { mockWalletBalance } from '../../../../helpers/test/testWalletHelper'
import { FeesRD, SendTxStateHandler } from '../../../../services/chain/types'
import { ApiError, ErrorId } from '../../../../services/wallet/types'
import { SendForm as Component, Props } from './SendForm'

type StoryArgs = Props & {
  txRDStatus: RDStatus
  feeRDStatus: RDStatus
  walletType: WalletType
  chainType: 'EVM' | 'UTXO' | 'COSMOS'
}

export default {
  title: 'Wallet/SendForm (Unified)',
  component: Component,
  argTypes: {
    walletType: {
      control: { type: 'select', options: ['keystore', 'ledger'] }
    },
    chainType: {
      control: { type: 'select', options: ['EVM', 'UTXO', 'COSMOS'] }
    }
  },
  args: {}
} as Meta<typeof Component>

// EVM Chain Story
export const EVMChain: StoryObj<StoryArgs> = {
  render: (args: StoryArgs) => {
    const { txRDStatus, feeRDStatus, walletType } = args

    const transfer$: SendTxStateHandler = (_) =>
      Rx.of({
        steps: { current: txRDStatus === 'initial' ? 0 : 1, total: 1 },
        status: FP.pipe(
          txRDStatus,
          getMockRDValueFactory<ApiError, TxHash>(
            () => 'tx-hash',
            () => ({
              msg: 'error message',
              errorId: ErrorId.SEND_TX
            })
          )
        )
      })

    const feesRD: FeesRD = FP.pipe(
      feeRDStatus,
      getMockRDValueFactory<Error, Fees>(
        () => ({
          type: FeeType.PerByte,
          fastest: assetToBase(assetAmount(0.002499, ETH_DECIMAL)),
          fast: assetToBase(assetAmount(0.002079, ETH_DECIMAL)),
          average: assetToBase(assetAmount(0.001848, ETH_DECIMAL))
        }),
        () => Error('getting fees failed')
      )
    )

    const ethBalance = mockWalletBalance({
      asset: AssetETH,
      amount: assetToBase(assetAmount(1.0, ETH_DECIMAL)),
      walletAddress: 'ETH wallet address'
    })

    return (
      <Component
        {...args}
        asset={{
          asset: AssetETH,
          walletAddress: 'eth-address',
          walletType,
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }}
        transfer$={transfer$}
        balances={[ethBalance]}
        balance={ethBalance}
        fees={feesRD}
        reloadFeesHandler={() => console.log('Reload fees handler invoked')}
        validatePassword$={mockValidatePassword$}
        network={Network.Testnet}
        poolDetails={[]}
        oPoolAddress={O.none}
        mayaScanPrice={FP.pipe(
          'success',
          getMockRDValueFactory(
            () => ({
              asset: AssetETH,
              amount: assetAmount(2000),
              mayaPriceInCacao: { asset: AssetETH, amount: assetToBase(assetAmount(100)) },
              mayaPriceInUsd: { asset: AssetETH, amount: assetToBase(assetAmount(2000)) },
              cacaoPriceInUsd: { asset: AssetETH, amount: assetToBase(assetAmount(0.02)) }
            }),
            () => Error('Failed to get price')
          )
        )}
        openExplorerTxUrl={(txHash: TxHash) => {
          console.log(`Open explorer - tx hash ${txHash}`)
          return Promise.resolve(true)
        }}
        getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
        addressValidation={(address: string) => address.length > 0}
      />
    )
  },
  args: {
    txRDStatus: 'success',
    feeRDStatus: 'success',
    walletType: WalletType.Keystore,
    chainType: 'EVM'
  }
}

// UTXO Chain Story
export const UTXOChain: StoryObj<StoryArgs> = {
  render: (args: StoryArgs) => {
    const { txRDStatus, feeRDStatus, walletType } = args

    const transfer$: SendTxStateHandler = (_) =>
      Rx.of({
        steps: { current: txRDStatus === 'initial' ? 0 : 1, total: 1 },
        status: FP.pipe(
          txRDStatus,
          getMockRDValueFactory<ApiError, TxHash>(
            () => 'tx-hash',
            () => ({
              msg: 'error message',
              errorId: ErrorId.SEND_TX
            })
          )
        )
      })

    const btcBalance = mockWalletBalance({
      asset: AssetBTC,
      amount: assetToBase(assetAmount(0.1, 8)),
      walletAddress: 'BTC wallet address'
    })

    return (
      <Component
        {...args}
        asset={{
          asset: AssetBTC,
          walletAddress: 'btc-address',
          walletType,
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }}
        transfer$={transfer$}
        balances={[btcBalance]}
        balance={btcBalance}
        feesWithRates={FP.pipe(
          feeRDStatus,
          getMockRDValueFactory(
            () => ({
              fees: {
                type: FeeType.PerByte,
                fastest: assetToBase(assetAmount(0.0001, 8)),
                fast: assetToBase(assetAmount(0.00008, 8)),
                average: assetToBase(assetAmount(0.00006, 8))
              },
              rates: {
                fastest: 10,
                fast: 8,
                average: 6
              }
            }),
            () => Error('getting fees failed')
          )
        )}
        reloadFeesHandler={() => console.log('Reload fees handler invoked')}
        validatePassword$={mockValidatePassword$}
        network={Network.Testnet}
        poolDetails={[]}
        oPoolAddress={O.none}
        mayaScanPrice={FP.pipe(
          'success',
          getMockRDValueFactory(
            () => ({
              asset: AssetBTC,
              amount: assetAmount(50000),
              mayaPriceInCacao: { asset: AssetBTC, amount: assetToBase(assetAmount(2500)) },
              mayaPriceInUsd: { asset: AssetBTC, amount: assetToBase(assetAmount(50000)) },
              cacaoPriceInUsd: { asset: AssetBTC, amount: assetToBase(assetAmount(0.02)) }
            }),
            () => Error('Failed to get price')
          )
        )}
        openExplorerTxUrl={(txHash: TxHash) => {
          console.log(`Open explorer - tx hash ${txHash}`)
          return Promise.resolve(true)
        }}
        getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
        addressValidation={(address: string) => address.length > 0}
      />
    )
  },
  args: {
    txRDStatus: 'success',
    feeRDStatus: 'success',
    walletType: WalletType.Keystore,
    chainType: 'UTXO'
  }
}

// COSMOS Chain Story
export const COSMOSChain: StoryObj<StoryArgs> = {
  render: (args: StoryArgs) => {
    const { txRDStatus, feeRDStatus, walletType } = args

    const transfer$: SendTxStateHandler = (_) =>
      Rx.of({
        steps: { current: txRDStatus === 'initial' ? 0 : 1, total: 1 },
        status: FP.pipe(
          txRDStatus,
          getMockRDValueFactory<ApiError, TxHash>(
            () => 'tx-hash',
            () => ({
              msg: 'error message',
              errorId: ErrorId.SEND_TX
            })
          )
        )
      })

    const atomBalance = mockWalletBalance({
      asset: AssetATOM,
      amount: assetToBase(assetAmount(10, 6)),
      walletAddress: 'ATOM wallet address'
    })

    return (
      <Component
        {...args}
        asset={{
          asset: AssetATOM,
          walletAddress: 'atom-address',
          walletType,
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }}
        transfer$={transfer$}
        balances={[atomBalance]}
        balance={atomBalance}
        fee={FP.pipe(
          feeRDStatus,
          getMockRDValueFactory(
            () => assetToBase(assetAmount(0.001, 6)),
            () => Error('getting fees failed')
          )
        )}
        reloadFeesHandler={() => console.log('Reload fees handler invoked')}
        validatePassword$={mockValidatePassword$}
        network={Network.Testnet}
        poolDetails={[]}
        oPoolAddress={O.none}
        mayaScanPrice={FP.pipe(
          'success',
          getMockRDValueFactory(
            () => ({
              asset: AssetATOM,
              amount: assetAmount(8),
              mayaPriceInCacao: { asset: AssetATOM, amount: assetToBase(assetAmount(0.4)) },
              mayaPriceInUsd: { asset: AssetATOM, amount: assetToBase(assetAmount(8)) },
              cacaoPriceInUsd: { asset: AssetATOM, amount: assetToBase(assetAmount(0.02)) }
            }),
            () => Error('Failed to get price')
          )
        )}
        openExplorerTxUrl={(txHash: TxHash) => {
          console.log(`Open explorer - tx hash ${txHash}`)
          return Promise.resolve(true)
        }}
        getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
        addressValidation={(address: string) => address.length > 0}
      />
    )
  },
  args: {
    txRDStatus: 'success',
    feeRDStatus: 'success',
    walletType: WalletType.Keystore,
    chainType: 'COSMOS'
  }
}
