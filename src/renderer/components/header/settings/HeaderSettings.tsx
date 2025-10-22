import { Cog8ToothIcon } from '@heroicons/react/20/solid'
import { useIntl } from 'react-intl'

import { Label } from '../../uielements/label'
import { Tooltip } from '../../uielements/tooltip'

export type Props = {
  onPress?: () => void
  isDesktopView: boolean
}

export const HeaderSettings = (props: Props): JSX.Element => {
  const { onPress = () => {}, isDesktopView } = props
  const intl = useIntl()

  return (
    <div className="flex w-full items-center justify-between px-6 lg:w-auto lg:px-0" onClick={onPress}>
      {!isDesktopView && (
        <Label size="large" textTransform="uppercase" weight="bold">
          {intl.formatMessage({ id: 'common.settings' })}
        </Label>
      )}
      <Tooltip title={intl.formatMessage({ id: 'common.settings' })}>
        <Cog8ToothIcon className="ease h-[24px] w-[24px] cursor-pointer text-text2 group-hover:rotate-180 dark:text-text2d" />
      </Tooltip>
    </div>
  )
}
