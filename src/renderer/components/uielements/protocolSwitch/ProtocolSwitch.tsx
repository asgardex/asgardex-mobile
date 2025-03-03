import { useCallback, useMemo } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { useIntl } from 'react-intl'

import { Tooltip } from '../common/Common.styles'
import { RadioGroup } from '../radioGroup'
import { Props, Protocol, Protocols, ProtocolsWithAll } from './types'

export const ProtocolSwitch = ({ protocol, setProtocol, withAll = false }: Props) => {
  const intl = useIntl()
  const protocols = useMemo(() => (withAll ? ProtocolsWithAll : Protocols), [withAll])

  const activeIndex = useMemo(() => {
    const currentIndex = protocols.findIndex((availableProtocol) => availableProtocol === protocol)

    if (currentIndex === -1) {
      setProtocol(protocols[0])
      return 0
    }

    return currentIndex
  }, [protocol, protocols, setProtocol])

  const onChange = useCallback(
    (index: number) => {
      setProtocol(protocols[index])
    },
    [protocols, setProtocol]
  )

  const protocolOptions = useMemo(() => {
    return [
      {
        label: (
          <Tooltip title="Switch to THORChain" placement="bottom">
            <span className="px-1 text-text2 dark:text-text2d">THORChain</span>
          </Tooltip>
        ),
        value: THORChain
      },
      {
        label: (
          <Tooltip title="Switch to MAYAChain" placement="bottom">
            <span className="px-1 text-text2 dark:text-text2d">MAYAChain</span>
          </Tooltip>
        ),
        value: MAYAChain
      },
      ...(withAll
        ? [
            {
              label: (
                <Tooltip title="All" placement="bottom">
                  <span className="px-1 text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.all' })}</span>
                </Tooltip>
              ),
              value: Protocol.All
            }
          ]
        : [])
    ]
  }, [intl, withAll])

  return (
    <div>
      <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={onChange} />
    </div>
  )
}
