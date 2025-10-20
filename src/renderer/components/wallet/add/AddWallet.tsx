import { useCallback } from 'react'

import { FolderPlusIcon, FolderOpenIcon, LockOpenIcon } from '@heroicons/react/20/solid'
import { useIntl } from 'react-intl'
import { useLocation, useNavigate } from 'react-router-dom'

import * as walletRoutes from '../../../routes/wallet'
import { Button } from '../../uielements/button'
import { Label } from '../../uielements/label'

export type Props = { isLocked?: boolean }

export const AddWallet = ({ isLocked = false }: Props) => {
  const intl = useIntl()
  const navigate = useNavigate()
  const location = useLocation()
  const onButtonClick = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  const intlLabelId = isLocked ? 'wallet.unlock.instruction' : 'wallet.connect.instruction'
  const intlButtonId = isLocked ? 'wallet.action.unlock' : 'wallet.action.connect'

  return (
    <div className="p-[150px_20px] bg-bg0 dark:bg-bg0d flex flex-col items-center justify-center w-full h-full">
      {isLocked ? (
        <LockOpenIcon className="h-[60px] w-[60px] mb-0 stroke-gray2 dark:stroke-gray2d" />
      ) : (
        <FolderPlusIcon className="h-[60px] w-[60px] mb-0 stroke-gray2 dark:stroke-gray2d" />
      )}
      <Label className="!w-auto" textTransform="uppercase">
        {intl.formatMessage({ id: intlLabelId })}
      </Label>
      <Button onClick={onButtonClick} round="true">
        {isLocked ? <FolderOpenIcon color="primary" /> : <FolderPlusIcon />}
        {intl.formatMessage({ id: intlButtonId })}
      </Button>
    </div>
  )
}
