import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'

import { AssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import * as C from './Common.types'

export type Props = {
  source: C.AssetData
  target: C.AssetData
  stepDescription: string
  network: Network
}

export const SwapAssets = (props: Props): JSX.Element => {
  const { source, target, stepDescription, network } = props
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] font-main text-center uppercase">
        {stepDescription}
      </Label>
      <div className="flex flex-col justify-center items-center relative w-full gap-1">
        <div className="flex items-center justify-between w-full px-10">
          <AssetData
            asset={source.asset}
            network={network}
            size="small"
            className="flex items-center justify-start w-full"
          />
          <Label className="text-3xl" align="right">
            {formatAssetAmount({ amount: baseToAsset(source.amount), trimZeros: true })}
          </Label>
        </div>
        <div className="flex justify-center items-center">
          <ArrowsRightLeftIcon className="w-8 h-8 text-gray-400 rotate-90" />
        </div>
        <div className="flex items-center justify-between w-full px-10">
          <AssetData
            asset={target.asset}
            network={network}
            size="small"
            className="flex items-center justify-start w-full"
          />
          <Label className="text-3xl" align="right">
            {formatAssetAmount({ amount: baseToAsset(target.amount), trimZeros: true })}
          </Label>
        </div>
      </div>
    </div>
  )
}
