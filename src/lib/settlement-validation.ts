import type { ChainId, Settlement } from './schema'

const explorerDomains: Partial<Record<ChainId, string>> = {
  bsc: 'bscscan.com',
  sol: 'solscan.io',
  eth: 'etherscan.io',
  base: 'basescan.org',
}

const sameInstant = (left: string, right: string) => {
  const leftTimestamp = Date.parse(left)
  const rightTimestamp = Date.parse(right)
  return (
    !Number.isNaN(leftTimestamp) &&
    !Number.isNaN(rightTimestamp) &&
    leftTimestamp === rightTimestamp
  )
}

export const periodsMatch = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
) => sameInstant(leftStart, rightStart) && sameInstant(leftEnd, rightEnd)

export const adjustedSettlementHasNote = (
  status: Settlement['status'],
  note: string | null,
) => status !== 'adjusted' || Boolean(note?.trim())

export const explorerUrlContainsTransactionHash = (
  explorerUrl: string,
  transactionHash: string,
) => new URL(explorerUrl).href.toLowerCase().includes(transactionHash.toLowerCase())

export const explorerUrlMatchesPaymentChain = (
  explorerUrl: string,
  paymentChain: ChainId,
) => {
  const expectedDomain = explorerDomains[paymentChain]
  if (!expectedDomain) return true

  const hostname = new URL(explorerUrl).hostname.toLowerCase()
  return hostname === expectedDomain || hostname.endsWith(`.${expectedDomain}`)
}
