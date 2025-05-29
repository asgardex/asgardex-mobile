import { useIntl } from 'react-intl'

import { HeaderTheme } from '../../../components/header/theme'
import { BackLinkButton } from '../../../components/uielements/button'
import { Headline } from '../../../components/uielements/headline'
import { PhraseView } from './PhraseView'

export const CreateView = () => {
  const intl = useIntl()

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
