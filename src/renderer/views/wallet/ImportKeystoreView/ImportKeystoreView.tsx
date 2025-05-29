import React, { useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { HeaderTheme } from '../../../components/header/theme'
import { BackLinkButton } from '../../../components/uielements/button'
import { Headline } from '../../../components/uielements/headline'
import { ImportKeystore } from '../../../components/wallet/keystore'
import { useWalletContext } from '../../../contexts/WalletContext'
import { getWalletNamesFromKeystoreWallets } from '../../../helpers/walletHelper'
import { useKeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { useKeystoreWallets } from '../../../hooks/useKeystoreWallets'
import * as walletRoutes from '../../../routes/wallet'
import { generateKeystoreId } from '../../../services/wallet/util'

export const ImportKeystoreView: React.FC = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()

  const {
    keystoreService: { importKeystore, loadKeystore$, importingKeystoreState$, resetImportingKeystoreState }
  } = useWalletContext()

  const importingKeystoreState = useObservableState(importingKeystoreState$, RD.initial)

  const { clientStates } = useKeystoreClientStates()

  const { walletsUI } = useKeystoreWallets()
  const walletNames = useMemo(() => getWalletNamesFromKeystoreWallets(walletsUI), [walletsUI])

  // Reset `ImportingKeystoreState` by entering the view
  useEffect(() => {
    resetImportingKeystoreState()
  }, [resetImportingKeystoreState])

  // Redirect after successful import
  useEffect(() => {
    if (RD.isSuccess(importingKeystoreState)) {
      resetImportingKeystoreState()
      // redirect to wallets assets view
      navigate(walletRoutes.assets.path())
    }
  }, [navigate, importingKeystoreState, resetImportingKeystoreState])

  const walletId = useMemo(() => generateKeystoreId(), [])

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
          <Headline>{intl.formatMessage({ id: 'wallet.imports.wallet' })}</Headline>
        </div>

        <ImportKeystore
          walletId={walletId}
          walletNames={walletNames}
          loadKeystore$={loadKeystore$}
          importKeystore={importKeystore}
          importingKeystoreState={importingKeystoreState}
          clientStates={clientStates}
        />
      </div>
    </div>
  )
}
