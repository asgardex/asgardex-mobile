import { useCallback, useState } from 'react'

import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetDOGE } from '@xchainjs/xchain-doge'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetTCY } from '@xchainjs/xchain-thorchain'
import clsx from 'clsx'

import { AssetData } from '../../../components/uielements/assets/assetData'
import { FlatButton, RefreshButton } from '../../../components/uielements/button'
import { Tooltip } from '../../../components/uielements/common/Common.styles'
import { InputBigNumber } from '../../../components/uielements/input'
import { AssetsNav } from '../../../components/wallet/assets'
import { useNetwork } from '../../../hooks/useNetwork'
import { TcyClaimModal } from './TcyClaimModal'
import { TcyInfo, TcyOperation } from './types'

const tcyTabs = [TcyOperation.Claim, TcyOperation.Stake, TcyOperation.Unstake]

const mockData: TcyInfo[] = [
  {
    asset: AssetBTC,
    amount: 2593,
    isClaimed: false
  },
  {
    asset: AssetETH,
    amount: 25493,
    isClaimed: false
  },
  {
    asset: AssetDOGE,
    amount: 12593,
    isClaimed: false
  }
]

export const TcyView = () => {
  const { network } = useNetwork()
  const [activeTab, setActiveTab] = useState(TcyOperation.Claim)
  const [selectedAsset, setSelectedAsset] = useState<TcyInfo>()
  const [isClaimModalVisible, setClaimModalVisible] = useState(false)

  const refreshHandler = useCallback(async () => {}, [])

  const handleClaim = useCallback((tcyInfo: TcyInfo) => {
    setSelectedAsset(tcyInfo)
    setClaimModalVisible(true)
  }, [])

  return (
    <>
      <div className="flex w-full justify-end pb-20px">
        <RefreshButton onClick={refreshHandler} />
      </div>

      <AssetsNav />

      <div className="grid grid-cols-8 gap-2 bg-bg1 dark:bg-bg1d rounded-b-lg space-x-0 space-y-2 sm:space-x-2 sm:space-y-0 py-8 px-4 sm:px-8">
        <div className="col-span-8 md:col-span-5">
          <div className="flex flex-col py-4 w-full border border-solid border-gray0 dark:border-gray0d rounded-lg ">
            <div className="flex flex-row space-x-4 px-4 pb-4 mb-4 border-b border-solid border-gray0 dark:border-gray0d">
              {tcyTabs.map((tab) => (
                <div key={tab} className="cursor-pointer" onClick={() => setActiveTab(tab)}>
                  <span
                    className={clsx('text-16', activeTab === tab ? 'text-turquoise' : 'text-text2 dark:text-text2d')}>
                    {tab}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col px-4">
              {activeTab === TcyOperation.Claim && (
                <div>
                  <span className="text-text2 dark:text-text2d text-16">
                    You have these TCY tokens available to claim in your wallet.
                  </span>
                  <div className="mt-4 border border-solid border-gray0 dark:border-gray0d rounded-lg">
                    {mockData.map((tcyData, index) => (
                      <div key={index} className="flex items-center justify-between px-4">
                        <div className="flex items-center space-x-2">
                          <div className="min-w-[120px]">
                            <AssetData asset={tcyData.asset} network={network} />
                          </div>
                          <span className="text-text2 dark:text-text2d">{tcyData.amount}</span>
                        </div>
                        {!tcyData.isClaimed && (
                          <FlatButton
                            className="p-2 bg-turquoise text-white cursor-pointer rounded-lg text-11 uppercase"
                            onClick={() => handleClaim(tcyData)}>
                            Claim
                          </FlatButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === TcyOperation.Stake && (
                <div className="flex flex-col space-y-2">
                  <span className="text-text2 dark:text-text2d text-16">You can stake them to earn RUNE.</span>
                  <div className="flex items-center justify-between rounded-lg py-2 px-4 border border-gray0 dark:border-gray0d">
                    <div className="flex flex-col">
                      <InputBigNumber
                        size="xlarge"
                        ghost
                        decimal={8}
                        // override text style of input for acting as label only
                        className={clsx('w-full px-0 leading-none text-text0 !opacity-100 dark:text-text0d')}
                      />

                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        Balance: 10,000
                      </p>
                    </div>
                    <AssetData asset={AssetTCY} network={network} />
                  </div>
                  <FlatButton className="my-30px min-w-[200px]" size="large" color="primary">
                    Stake
                  </FlatButton>
                </div>
              )}
              {activeTab === TcyOperation.Unstake && (
                <div className="flex flex-col space-y-2">
                  <span className="text-text2 dark:text-text2d text-16">Unstake to move your TCY to your wallet.</span>
                  <div className="flex items-center justify-between rounded-lg py-2 px-4 border border-gray0 dark:border-gray0d">
                    <div className="flex flex-col">
                      <InputBigNumber
                        size="xlarge"
                        ghost
                        decimal={8}
                        // override text style of input for acting as label only
                        className={clsx('w-full px-0 leading-none text-text0 !opacity-100 dark:text-text0d')}
                      />

                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        Balance: 10,000
                      </p>
                    </div>
                    <AssetData asset={AssetTCY} network={network} />
                  </div>
                  <FlatButton className="my-30px min-w-[200px]" size="large" color="primary">
                    Unstake
                  </FlatButton>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-8 md:col-span-3">
          <div className="flex flex-col py-4 w-full border border-solid border-gray0 dark:border-gray0d rounded-lg">
            <div className="flex flex-row space-x-2 px-4 pb-4 mb-4 border-b border-solid border-gray0 dark:border-gray0d">
              <span className="text-16 text-text2 dark:text-text2d">TCY Status</span>
            </div>

            <div className="flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-16 text-text2 dark:text-text2d">Staked Amount</span>
                {/* TODO: locale */}
                <Tooltip title="Staked Amount includes your Keystore and Ledger Balances">
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <span className="text-turquoise">1000 TCY</span>.
            </div>

            <div className="flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-16 text-text2 dark:text-text2d">Wallet Balance</span>
                {/* TODO: locale */}
                <Tooltip title="Wallet balance includes your Keystore and Ledger Balances">
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <span className="text-turquoise">1000 TCY</span>
            </div>
          </div>
        </div>
      </div>
      {selectedAsset && (
        <TcyClaimModal
          isVisible={isClaimModalVisible}
          tcyInfo={selectedAsset}
          onClose={() => setClaimModalVisible(false)}
        />
      )}
    </>
  )
}
