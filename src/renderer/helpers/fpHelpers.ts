import * as RD from '@devexperts/remote-data-ts'
import { function } from 'fp-ts'
const { Lazy } = function
import { apply } from 'fp-ts'
const { sequenceS, sequenceT } = apply
import { array as A } from 'fp-ts'
import { option as O } from 'fp-ts'

/**
 * Sequence
 */

export const sequenceTOption = sequenceT(O.Apply)
export const sequenceTOptionFromArray = A.sequence(O.Applicative)
export const sequenceSOption = sequenceS(O.Applicative)

export const sequenceTRD = sequenceT(RD.remoteData)
export const sequenceTRDFromArray = A.sequence(RD.remoteData)

/**
 * Creation
 */
export const rdFromOption =
  <L, A>(onNone: Lazy<L>) =>
  (v: O.Option<A>) =>
    RD.fromOption(v, onNone)

export const rdAltOnPending =
  <L, A>(onPending: () => RD.RemoteData<L, A>) =>
  (rd: RD.RemoteData<L, A>): RD.RemoteData<L, A> => {
    if (RD.isPending(rd)) {
      return onPending()
    }
    return rd
  }
