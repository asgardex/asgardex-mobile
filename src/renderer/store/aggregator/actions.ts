import { createAsyncThunk } from '@reduxjs/toolkit'
import { Aggregator, QuoteSwapParams } from '@xchainjs/xchain-aggregator'

import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../shared/const'

export const getEstimate = createAsyncThunk(
  'aggregator/estimate',
  async ({
    aggregator,
    params,
    useAffiliate
  }: {
    aggregator: Aggregator
    params: QuoteSwapParams
    useAffiliate: Boolean
  }) => {
    try {
      if (useAffiliate) {
        aggregator.setConfiguration({
          affiliate: {
            basisPoints: ASGARDEX_AFFILIATE_FEE,
            affiliates: { Thorchain: ASGARDEX_THORNAME, Mayachain: ASGARDEX_THORNAME }
          }
        })
        const estimate = await aggregator.estimateSwap(params)
        return estimate
      } else {
        aggregator.setConfiguration({
          affiliate: { basisPoints: 0, affiliates: { Thorchain: ASGARDEX_THORNAME, Mayachain: ASGARDEX_THORNAME } }
        })
        const estimate = await aggregator.estimateSwap(params)
        return estimate
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
)
