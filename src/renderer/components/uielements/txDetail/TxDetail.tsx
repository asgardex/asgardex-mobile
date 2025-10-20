import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { baseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { array as A, function as FP, nonEmptyArray as NEA, option as O } from 'fp-ts'

import { isCacaoAsset } from '../../../helpers/assetHelper'
import { AssetIcon } from '../assets/assetIcon'
import { Fees } from '../fees'
import { ActionProps } from './types'

export const TxDetail = ({ className, outgos, incomes, fees = [], slip, network, isDesktopView }: ActionProps) => {
  const renderIncomes = useMemo(
    () =>
      FP.pipe(
        incomes,
        A.mapWithIndex((index, { asset, amount }) => (
          <div key={`in-${index}`} className="flex items-center">
            {isDesktopView && <AssetIcon className="mx-1" size="xsmall" asset={asset} network={network} />}
            <div className="whitespace-nowrap px-1 lg:px-0">
              {formatAssetAmountCurrency({
                trimZeros: true,
                amount: baseToAsset(
                  isCacaoAsset(asset) ? baseAmount(amount.amount().toNumber(), CACAO_DECIMAL) : amount
                ),
                asset
              })}
            </div>
          </div>
        ))
      ),
    [incomes, network, isDesktopView]
  )

  const renderOutgos = useMemo(
    () =>
      FP.pipe(
        outgos,
        A.mapWithIndex((index, { asset, amount }) => {
          return (
            <div key={`out-${index}`} className="flex items-center">
              {isDesktopView && <AssetIcon className="mx-1" size="xsmall" asset={asset} network={network} />}
              <div className="whitespace-nowrap px-1 lg:px-0">
                {formatAssetAmountCurrency({
                  trimZeros: true,
                  amount: baseToAsset(
                    isCacaoAsset(asset) ? baseAmount(amount.amount().toNumber(), CACAO_DECIMAL) : amount
                  ),
                  asset
                })}
              </div>
            </div>
          )
        })
      ),
    [outgos, network, isDesktopView]
  )

  const feesComponent = useMemo(
    () =>
      FP.pipe(
        fees,
        NEA.fromArray,
        O.map(RD.success),
        O.map((fees) => (
          <div key="fees" className="inline-block relative mr-0.5 first:ml-0 last:mr-0">
            <Fees fees={fees} />
          </div>
        )),
        O.getOrElse(() => <></>)
      ),
    [fees]
  )

  return (
    <div className={clsx('flex flex-col items-start', className)}>
      <div className="flex flex-wrap text-left md:mr-4 last:mr-0">
        <div
          className={clsx(
            'flex items-center text-xs uppercase px-[5px] py-[3px] leading-[22px]',
            'bg-bg2 dark:bg-bg2d border border-gray2 dark:border-gray2d text-text0 dark:text-text0d',
            'first:rounded-l-[1.7rem] first:self-start last:rounded-r-[1.7rem]',
            'md:text-sm md:px-[10px] md:py-[5px]'
          )}>
          <span className="text-xs text-text2 dark:text-text2d uppercase mr-1 first:mr-1 first:ml-1 last:ml-1 only:m-0">
            in
          </span>
          {renderIncomes}
        </div>
        <div
          className={clsx(
            'flex items-center text-xs uppercase px-[5px] py-[3px] leading-[22px]',
            'bg-bg2 dark:bg-bg2d border border-gray2 dark:border-gray2d text-text0 dark:text-text0d',
            'first:rounded-l-[1.7rem] first:self-start last:rounded-r-[1.7rem]',
            'md:text-sm md:px-[10px] md:py-[5px]'
          )}>
          {renderOutgos}
          <span className="text-xs text-text2 dark:text-text2d uppercase mr-1 first:mr-1 first:ml-1 last:ml-1 only:m-0">
            out
          </span>
        </div>
      </div>

      <span className="mr-[10px] last:mr-0 text-gray2 dark:text-gray2d text-sm p-0">
        {feesComponent}
        {slip && <div className="inline-block relative mr-[2px] first:ml-0 last:mr-0">slip: {slip}%</div>}
      </span>
    </div>
  )
}
