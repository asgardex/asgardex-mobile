import { Network } from '@xchainjs/xchain-client'

import { AssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import * as C from './Common.types'

type Props = {
  asset: C.AssetData
  description: string
  network: Network
}

export const SendAsset = (props: Props): JSX.Element => {
  const { asset, description = '', network } = props
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] text-center uppercase">
        {description}
      </Label>
      <div className="flex justify-center items-center relative">
        <div className="px-5 flex flex-col">
          <AssetData size="big" asset={asset.asset} amount={asset.amount} network={network} />
        </div>
      </div>
    </div>
  )
}
