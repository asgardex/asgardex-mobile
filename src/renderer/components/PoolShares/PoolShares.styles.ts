import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Table as UITable } from '../uielements/table'

export const Table = styled(UITable)`
  .ant-table-thead > tr {
    background: ${palette('gray', 0)};
    & > th {
      font-size: 14px;
      border: none;
      padding-top: 2px;
      padding-bottom: 2px;
      padding-left: 30px;
      height: auto;
      background: none !important;
      color: ${palette('gray', 2)};
      font-weight: 300;
      text-align: center;

      &:hover {
        background: none !important;
      }
    }
  }

  .ant-table-tbody > tr > td {
    padding: 0px 16px;
  }

  .ant-table-tbody > tr > td > div {
    font-size: 16px;
    font-weight: normal;
    text-transform: uppercase;
  }
`
