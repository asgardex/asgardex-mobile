import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset } from '@xchainjs/xchain-util'

import clsx from 'clsx'
import { AddressEllipsis } from '../../addressEllipsis'
import { AssetIcon, Size } from '../assetIcon'

type Props = {
  asset: AnyAsset
  address: Address
  network: Network
  size?: Size
  className?: string
  classNameAddress?: string
}

const fontSizeMap: Record<Size, string> = {
  large: 'text-[21px]',
  big: 'text-[19px]',
  normal: 'text-[16px]',
  small: 'text-[14px]',
  xsmall: 'text-[11px]'
}

export const AssetAddress = (props: Props) => {
  const { asset, address, network, size = 'normal', className = '', classNameAddress = '' } = props

  return (
    <div className={clsx('flex items-center', className)}>
      <AssetIcon asset={asset} size={size} network={network} />
      <div className="w-full overflow-hidden">
        <AddressEllipsis
          className={clsx('pl-1 normal-case', fontSizeMap[size], classNameAddress)}
          address={address}
          chain={asset.chain}
          network={network}
          enableCopy
        />
      </div>
    </div>
  )
}
