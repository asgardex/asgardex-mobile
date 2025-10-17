import { useMemo } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'

import { AssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import { StepBar } from '../../../uielements/stepBar'
import * as C from './Common.types'

type Props = {
  source: O.Option<C.AssetData>
  stepDescription: string
  network: Network
}

export const DepositAsset = (props: Props): JSX.Element => {
  const { source: oSource, stepDescription, network } = props

  const hasSource = useMemo(() => FP.pipe(oSource, O.isSome), [oSource])

  const renderSource = useMemo(
    () =>
      FP.pipe(
        oSource,
        O.map(({ asset, amount }) => (
          <AssetData key="source-data" className="mb-5 last:m-0" asset={asset} amount={amount} network={network} />
        )),
        O.getOrElse(() => <></>)
      ),
    [oSource, network]
  )

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] text-center uppercase">
        {stepDescription}
      </Label>
      <div className="flex justify-center items-center relative">
        {hasSource && <StepBar className="justify-center p-0.5" />}
        <div className="px-5 flex flex-col">{renderSource}</div>
      </div>
    </div>
  )
}
