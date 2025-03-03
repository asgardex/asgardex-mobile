export enum Protocol {
  THORChain = 'THOR',
  MAYAChain = 'MAYA',
  All = 'All'
}

export const Protocols: Protocol[] = [Protocol.THORChain, Protocol.MAYAChain]
export const ProtocolsWithAll: Protocol[] = [Protocol.THORChain, Protocol.MAYAChain, Protocol.All]

export type Props = {
  protocol: string
  setProtocol: (protocol: string) => void
  withAll?: boolean
}
