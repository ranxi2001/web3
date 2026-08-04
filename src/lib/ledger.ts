import type {
  ChainLedger,
  CustomerLedger,
  PublicLedger,
  Settlement,
} from './schema'

const HASH_NAMESPACE = 'web3-rebate:v1:'
const sameInstant = (left: string, right: string) => Date.parse(left) === Date.parse(right)

export const normalizeWalletAddress = (address: string) => {
  const trimmed = address.trim()
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed.toLowerCase() : trimmed
}

export const hashWalletAddress = async (address: string) => {
  const normalized = normalizeWalletAddress(address)
  const bytes = new TextEncoder().encode(`${HASH_NAMESPACE}${normalized}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export const looksLikeWalletAddress = (value: string) => {
  const input = value.trim()
  return /^0x[0-9a-fA-F]{40}$/.test(input) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)
}

export const findCustomer = async (ledger: PublicLedger, query: string) => {
  const input = query.trim()
  if (!input) return null

  const publicIdMatch = ledger.customers.find(
    (customer) => customer.publicId.toLowerCase() === input.toLowerCase(),
  )
  if (publicIdMatch) return publicIdMatch
  if (!looksLikeWalletAddress(input)) return null

  const hash = await hashWalletAddress(input)
  return (
    ledger.customers.find((customer) =>
      customer.walletLookupHashes.includes(hash),
    ) ?? null
  )
}

export const sumChains = (chains: ChainLedger[]) => ({
  confirmedVolumeUsd: chains.reduce(
    (total, chain) => total + chain.confirmedVolumeUsd,
    0,
  ),
  observedVolumeUsd: chains.reduce(
    (total, chain) => total + (chain.observedVolumeUsd ?? 0),
    0,
  ),
  tradeCount: chains.reduce(
    (total, chain) => total + (chain.observedTradeCount ?? 0),
    0,
  ),
  estimatedRebateUsd: chains.reduce(
    (total, chain) => total + chain.estimatedRebateUsd,
    0,
  ),
})

export const settlementsForCustomer = (
  settlements: Settlement[],
  customer: CustomerLedger,
) =>
  settlements
    .filter((item) => item.customerPublicId === customer.publicId)
    .sort(
      (a, b) =>
        Date.parse(b.paidAt ?? b.periodEnd) - Date.parse(a.paidAt ?? a.periodEnd),
    )

export const settledUsdForCustomer = (
  settlements: Settlement[],
  customer: CustomerLedger,
) =>
  settlementsForCustomer(settlements, customer)
    .filter((item) => item.status === 'paid' || item.status === 'adjusted')
    .reduce((total, item) => total + item.paidUsd, 0)

export const paidUsdForCurrentPeriod = (
  settlements: Settlement[],
  customer: CustomerLedger,
) =>
  settlementsForCustomer(settlements, customer)
    .filter(
      (item) =>
        sameInstant(item.periodStart, customer.periodStart) &&
        sameInstant(item.periodEnd, customer.periodEnd) &&
        (item.status === 'paid' || item.status === 'adjusted'),
    )
    .reduce((total, item) => total + item.paidUsd, 0)

export const pendingRebateUsd = (
  settlements: Settlement[],
  customer: CustomerLedger,
) =>
  Math.max(
    0,
    sumChains(customer.chains).estimatedRebateUsd -
      paidUsdForCurrentPeriod(settlements, customer),
  )

export const getFreshness = (chains: ChainLedger[]) => {
  if (chains.some((chain) => chain.status === 'manual_review')) return 'review'
  if (chains.some((chain) => chain.status === 'delayed')) return 'delayed'
  return 'current'
}

export const formatUsd = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  }).format(value)

export const formatNumber = (value: number, maximumFractionDigits = 4) =>
  new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits,
  }).format(value)

export const formatPercent = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    maximumFractionDigits,
  }).format(value)

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))

export const shortHash = (value: string) =>
  value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
