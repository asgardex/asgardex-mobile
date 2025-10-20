import React from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon as SyncOutlined } from '@heroicons/react/20/solid'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { Alert } from '../../components/uielements/alert'
import { BorderButton } from '../../components/uielements/button'

interface ErrorAlertProps {
  apiEndpoint: RD.RemoteData<Error, unknown>
  reloadHandler: () => void
}

const MidgardErrorAlert = ({ apiEndpoint, reloadHandler }: ErrorAlertProps) => {
  const intl = useIntl()
  const renderContent = FP.pipe(
    apiEndpoint,
    RD.fold(
      () => <></>,
      () => <></>,
      (e) => (
        <Alert
          className="mb-2 lg:mb-10 lg:first:mb-2"
          type="error"
          title={intl.formatMessage({ id: 'midgard.error.endpoint.title' })}
          description={e?.message ?? e.toString()}
          action={
            <BorderButton onClick={reloadHandler} color="error" size="medium">
              <SyncOutlined className="mr-10px" />
              {intl.formatMessage({ id: 'common.reload' })}
            </BorderButton>
          }
        />
      ),
      () => <></>
    )
  )

  return <>{renderContent}</>
}

export default MidgardErrorAlert
