import { useMemo } from 'react'

import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { HeaderTheme } from '../../../components/header/theme'
import { BackLinkButton } from '../../../components/uielements/button'
import { Headline } from '../../../components/uielements/headline'
import * as walletRoutes from '../../../routes/wallet'
import { PhraseView } from './PhraseView'

enum TabKey {
  PHRASE = 'phrase',
  KEYSTORE = 'keystore'
}

export const CreateView = () => {
  const intl = useIntl()
  const navigate = useNavigate()

  const items = useMemo(
    () => [
      {
        key: TabKey.PHRASE,
        label: (
          <span onClick={() => navigate(walletRoutes.create.phrase.path())}>
            {intl.formatMessage({ id: 'common.phrase' })}
          </span>
        ),
        content: <PhraseView />
      }
    ],
    [navigate, intl]
  )

  console.log('ITEMS - ', items)

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full bg-bg1 dark:bg-bg1d">
      <div className="absolute top-4 left-4 z-10">
        <BackLinkButton />
      </div>
      <div className="absolute top-4 right-4 z-10">
        <HeaderTheme isDesktopView />
      </div>
      <div className="flex flex-col p-4 w-full max-w-[380px]">
        <div className="flex items-center mb-10">
          <Headline>{intl.formatMessage({ id: 'wallet.create.title' })}</Headline>
        </div>
        <PhraseView />
      </div>
    </div>
  )
}
