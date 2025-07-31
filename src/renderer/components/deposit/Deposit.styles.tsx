import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../helpers/styleHelper'
import { Tabs as TabsUI } from '../tabs/Tabs'

export const Tabs = styled(TabsUI)`
  padding-top: 0;
  .ant-tabs {
    &-nav {
      &:before {
        border-bottom: 1px solid ${palette('gray', 1)};
      }
      padding: 0 10px;
      ${media.sm`
        padding: 0 50px;
    `}
    }
  }
`
