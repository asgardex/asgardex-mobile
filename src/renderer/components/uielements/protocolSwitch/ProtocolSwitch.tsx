import { useCallback, useMemo } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'

import { AVAILABLE_DEXS } from '../../../services/const'
import { Tooltip } from '../common/Common.styles'
import { RadioGroup } from '../radioGroup'

export type Props = {
  protocol: Chain
  setProtocol: (protocol: Chain) => void
}

export const ProtocolSwitch = ({ protocol, setProtocol }: Props) => {
  const activeIndex = useMemo(() => {
    const currentIndex = AVAILABLE_DEXS.findIndex((availableDex) => availableDex.chain === protocol)
    return currentIndex ?? 0
  }, [protocol])

  const onChange = useCallback(
    (index: number) => {
      setProtocol(AVAILABLE_DEXS[index].chain)
    },
    [setProtocol]
  )

  const protocolOptions = useMemo(() => {
    return [
      {
        label: (
          <Tooltip title="Switch pools to THORChain" placement="bottom">
            <span
              className={clsx(
                'px-1',
                activeIndex === 0
                  ? 'text-white'
                  : 'text-text2 hover:text-turquoise dark:text-text2d hover:dark:text-turquoise-dark'
              )}>
              THORChain
            </span>
          </Tooltip>
        ),
        value: THORChain
      },
      {
        label: (
          <Tooltip title="Switch pools to MAYAChain" placement="bottom">
            <span
              className={clsx(
                'px-1',
                activeIndex === 1
                  ? 'text-white'
                  : 'text-text2 hover:text-turquoise dark:text-text2d hover:dark:text-turquoise-dark'
              )}>
              MAYAChain
            </span>
          </Tooltip>
        ),
        value: MAYAChain
      }
    ]
  }, [activeIndex])

  return (
    <div>
      <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={onChange} />
    </div>
  )
}
