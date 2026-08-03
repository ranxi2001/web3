import ledgerJson from '../../public/data/ledger.json'
import { describe, expect, it } from 'vitest'
import {
  findCustomer,
  hashWalletAddress,
  normalizeWalletAddress,
  pendingRebateUsd,
  settlementsForCustomer,
  sumChains,
} from './ledger'
import { publicLedgerSchema } from './schema'
import {
  adjustedSettlementHasNote,
  explorerUrlContainsTransactionHash,
  explorerUrlMatchesPaymentChain,
  periodsMatch,
} from './settlement-validation'

const ledger = publicLedgerSchema.parse(ledgerJson)
const demoCustomer = ledger.customers[0]

describe('wallet lookup', () => {
  it('normalizes EVM addresses without changing Solana case', () => {
    expect(normalizeWalletAddress(' 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA ')).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )
    expect(normalizeWalletAddress('AbCdEf123456789ABCDEFGHJKLMNPQRSTUV')).toBe(
      'AbCdEf123456789ABCDEFGHJKLMNPQRSTUV',
    )
  })

  it('uses the documented versioned hash namespace', async () => {
    await expect(
      hashWalletAddress('0x1111111111111111111111111111111111111111'),
    ).resolves.toBe('3b684dc7da6c92069957b1591f39e324386b6f0b3268fcd4168d3c70bab6b8dc')
  })

  it('finds an account by public id or wallet without publishing the wallet', async () => {
    await expect(findCustomer(ledger, 'rl-8f2k-91q')).resolves.toEqual(demoCustomer)
    await expect(
      findCustomer(ledger, '0x1111111111111111111111111111111111111111'),
    ).resolves.toEqual(demoCustomer)
    expect(JSON.stringify(ledger)).not.toContain('0x1111111111111111111111111111111111111111')
  })
})

describe('public ledger totals', () => {
  it('keeps confirmed volume, observed volume, and estimated rebate separate', () => {
    const totals = sumChains(demoCustomer.chains)
    expect(totals.confirmedVolumeUsd).toBeCloseTo(528440.78, 2)
    expect(totals.observedVolumeUsd).toBeCloseTo(528310.51, 2)
    expect(totals.estimatedRebateUsd).toBeCloseTo(1585.32, 2)
    expect(totals.tradeCount).toBe(1970)
  })

  it('sorts settlement history newest first', () => {
    const settlements = settlementsForCustomer(ledger.settlements, demoCustomer)
    expect(settlements.map((item) => item.batchId)).toEqual([
      'SET-2026-07-001',
      'SET-2026-06-001',
    ])
  })

  it('subtracts finalized payments from the matching settlement period', () => {
    const currentPayment = {
      ...ledger.settlements[0],
      batchId: 'SET-CURRENT-PARTIAL',
      periodStart: '2026-07-31T16:00:00Z',
      periodEnd: '2026-08-31T15:59:59Z',
      paidAmount: 1,
      lockedPriceUsd: 500,
      paidUsd: 500,
    }

    expect(
      pendingRebateUsd([...ledger.settlements, currentPayment], demoCustomer),
    ).toBeCloseTo(1085.32, 2)
  })

  it('subtracts adjusted payments from the matching settlement period', () => {
    const currentAdjustment = {
      ...ledger.settlements[0],
      batchId: 'SET-CURRENT-ADJUSTMENT',
      periodStart: demoCustomer.periodStart,
      periodEnd: demoCustomer.periodEnd,
      status: 'adjusted' as const,
      note: '补充支付差额',
      paidAmount: 0.5,
      lockedPriceUsd: 500,
      paidUsd: 250,
    }

    expect(
      pendingRebateUsd([...ledger.settlements, currentAdjustment], demoCustomer),
    ).toBeCloseTo(1335.32, 2)
  })
})

describe('earnings showcase', () => {
  it('publishes the masked Solana example with reproducible rebate math', () => {
    const { showcase } = ledger

    expect(showcase).toMatchObject({
      id: 'gmgn-solana-600k-2026-08',
      maskedWallet: '6EDJ...3xj5',
      network: 'Solana',
      volumeUsd: 600900,
      platformFeeRate: 0.01,
      customerShareRate: 0.3,
      effectiveRebateRate: 0.003,
      estimatedRebateUsd: 1802.7,
      sourceLabel: 'GMGN 钱包页人工快照',
    })
    expect(Date.parse(showcase.snapshotAt)).not.toBeNaN()
    expect(showcase.effectiveRebateRate).toBeCloseTo(
      showcase.platformFeeRate * showcase.customerShareRate,
      9,
    )
    expect(showcase.estimatedRebateUsd).toBeCloseTo(
      showcase.volumeUsd * showcase.effectiveRebateRate,
      2,
    )
  })

  it('keeps the prior-month placeholder outside settlement records', () => {
    expect(ledger.showcase.lastMonth).toEqual({
      label: '2026年7月',
      settledUsd: 300,
      asset: 'U',
      placeholder: true,
      note: '展示占位数据，仅用于收益案例说明，不代表已付款，也无链上付款凭证。',
    })
    expect(
      ledgerJson.settlements.some((settlement) => 'placeholder' in settlement),
    ).toBe(false)
    expect(() =>
      publicLedgerSchema.parse({
        ...ledgerJson,
        settlements: [
          { ...ledgerJson.settlements[0], placeholder: true },
          ...ledgerJson.settlements.slice(1),
        ],
      }),
    ).toThrow()
  })
})

describe('ledger validation helpers', () => {
  it('matches equivalent settlement periods across timezone representations', () => {
    expect(
      periodsMatch(
        '2026-08-01T00:00:00+08:00',
        '2026-08-31T23:59:59+08:00',
        '2026-07-31T16:00:00Z',
        '2026-08-31T15:59:59Z',
      ),
    ).toBe(true)
  })

  it('requires adjusted settlements to include a meaningful note', () => {
    expect(adjustedSettlementHasNote('adjusted', null)).toBe(false)
    expect(adjustedSettlementHasNote('adjusted', '   ')).toBe(false)
    expect(adjustedSettlementHasNote('adjusted', '补充支付差额')).toBe(true)
    expect(adjustedSettlementHasNote('paid', null)).toBe(true)
  })

  it('checks explorer chain domains and transaction hashes', () => {
    const hash = '0xABCDEF1234'
    const validUrl = `https://api.bscscan.com/tx/${hash.toLowerCase()}`

    expect(explorerUrlMatchesPaymentChain(validUrl, 'bsc')).toBe(true)
    expect(explorerUrlContainsTransactionHash(validUrl, hash)).toBe(true)
    expect(
      explorerUrlMatchesPaymentChain(`https://bscscan.com.example.org/tx/${hash}`, 'bsc'),
    ).toBe(false)
    expect(
      explorerUrlContainsTransactionHash('https://bscscan.com/tx/0x0000', hash),
    ).toBe(false)
  })
})
