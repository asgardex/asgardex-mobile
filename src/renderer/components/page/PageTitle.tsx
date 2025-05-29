import React from 'react'

import { BackLinkButton } from '../uielements/button'
import { Headline } from '../uielements/headline'

export const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative w-full mb-5">
      <Headline className="w-full">
        <div className="absolute left-0">
          <BackLinkButton />
        </div>
        {children}
      </Headline>
    </div>
  )
}
