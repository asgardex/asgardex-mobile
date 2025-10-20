import { useCallback, useMemo } from 'react'

import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import SunIcon from '../../../assets/svg/icon-theme-day.svg?react'
import MoonIcon from '../../../assets/svg/icon-theme-night.svg?react'
import { useTheme } from '../../../hooks/useTheme'
import { Label } from '../../uielements/label'

export type Props = {
  onPress?: FP.Lazy<void>
  isDesktopView: boolean
}

const DayThemeIcon = () => (
  <SunIcon className="cursor-pointer text-[1.5em] [&_path]:fill-text2 [&_path]:dark:fill-text2d" />
)

const NightThemeIcon = () => (
  <MoonIcon className="cursor-pointer text-[1.5em] [&_path]:fill-text0 [&_path]:dark:fill-text0d" />
)

export const HeaderTheme = (props: Props): JSX.Element => {
  const { onPress = FP.constVoid, isDesktopView } = props

  const intl = useIntl()

  const { isLight: isLightTheme, toggle: toggleTheme } = useTheme()

  const clickSwitchThemeHandler = useCallback(() => {
    toggleTheme()
    onPress()
  }, [toggleTheme, onPress])

  const desktopView = useMemo(() => (isLightTheme ? <DayThemeIcon /> : <NightThemeIcon />), [isLightTheme])

  const mobileView = useMemo(() => {
    const label = intl.formatMessage({ id: isLightTheme ? 'common.theme.light' : 'common.theme.dark' })

    return (
      <div className="flex items-center justify-between px-6 lg:px-4 w-full">
        <Label size="large" textTransform="uppercase" weight="bold">
          {label}
        </Label>
        {isLightTheme ? <DayThemeIcon /> : <NightThemeIcon />}
      </div>
    )
  }, [intl, isLightTheme])

  return (
    <div className="w-full lg:w-auto" onClick={() => clickSwitchThemeHandler()}>
      {isDesktopView ? desktopView : mobileView}
    </div>
  )
}
