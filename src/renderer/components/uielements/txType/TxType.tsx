import React from 'react'

import { PlusCircleOutlined, MinusCircleOutlined, ExperimentOutlined, StopOutlined } from '@ant-design/icons'
import { useIntl } from 'react-intl'

import DonateIcon from '../../../assets/svg/tx-donate.svg'
import RefundIcon from '../../../assets/svg/tx-refund.svg'
import RunePoolIcon from '../../../assets/svg/tx-runePool.svg'
import SendIcon from '../../../assets/svg/tx-send.svg'
import DepositIcon from '../../../assets/svg/tx-stake.svg'
import SwapIcon from '../../../assets/svg/tx-swap.svg'
import WithdrawIcon from '../../../assets/svg/tx-withdraw.svg'
import { getTxTypeI18n } from '../../../helpers/actionsHelper'
import { TxType as MidgardTxType } from '../../../services/midgard/midgardTypes'
import * as Styled from './TxType.styles'

type Props = {
  type: MidgardTxType
  showTypeIcon: boolean
  className?: string
}

const getIcon = (type: MidgardTxType) => {
  switch (type) {
    case 'DEPOSIT':
      return <DepositIcon />
    case 'WITHDRAW':
      return <WithdrawIcon />
    case 'SWAP':
      return <SwapIcon />
    case 'DONATE':
      return <DonateIcon />
    case 'REFUND':
      return <RefundIcon />
    case 'SEND':
      return <SendIcon />
    case 'RUNEPOOLDEPOSIT':
      return <RunePoolIcon />
    case 'RUNEPOOLWITHDRAW':
      return <RunePoolIcon className="rotate-180" />
    case 'BOND':
      return <PlusCircleOutlined className="text-[18px] !text-turquoise" />
    case 'UNBOND':
    case 'LEAVE':
      return <MinusCircleOutlined className="text-[18px] !text-turquoise" />
    case 'TRADE':
      return <ExperimentOutlined className="text-[18px] !text-turquoise" />
    case 'FAILED':
      return <StopOutlined className="text-[18px] !text-red" />
    default:
      return <></>
  }
}

export const TxType: React.FC<Props> = ({ type, showTypeIcon, className }) => {
  const intl = useIntl()

  return (
    <Styled.Container className={className}>
      {showTypeIcon && <Styled.IconContainer>{getIcon(type)}</Styled.IconContainer>}
      <Styled.Label>{getTxTypeI18n(type, intl)}</Styled.Label>
    </Styled.Container>
  )
}
