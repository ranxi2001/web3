import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { publicLedgerSchema } from '../src/lib/schema'
import {
  adjustedSettlementHasNote,
  explorerUrlContainsTransactionHash,
  explorerUrlMatchesPaymentChain,
  periodsMatch,
} from '../src/lib/settlement-validation'
import { z } from 'zod'

const ledgerPath = resolve('public/data/ledger.json')
const raw = JSON.parse(await readFile(ledgerPath, 'utf8'))
const ledger = publicLedgerSchema.parse(raw)
const errors: string[] = []

const referralDirectorySchema = z.object({
  version: z.number().int().positive(),
  source: z.object({
    provider: z.string().min(1),
    page: z.string().url(),
    okxMaterialPage: z.string().url(),
    checkedAt: z.string().min(1),
    pageBuildId: z.string().min(1),
  }),
  entries: z.array(
    z.object({
      id: z.string().min(1),
      platform: z.string().min(1),
      title: z.string().min(1),
      category: z.enum(['exchange', 'web3', 'card']),
      benefit: z.string().min(1),
      url: z.string().url(),
      targetDomain: z.string().min(1),
      domainKind: z.enum(['official', 'partner']),
      referralCode: z.string().min(1),
      iconUrl: z.string().url(),
      sourceItems: z.array(
        z.object({ id: z.string().min(1), title: z.string().min(1) }),
      ).min(1),
    }),
  ).min(1),
})

const closeEnough = (actual: number, expected: number, tolerance: number) =>
  Math.abs(actual - expected) <= tolerance

const assertUnique = (values: string[], label: string) => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length) errors.push(`${label} contains duplicates: ${[...new Set(duplicates)].join(', ')}`)
}

const assertDate = (value: string, label: string) => {
  if (Number.isNaN(Date.parse(value))) errors.push(`${label} is not a valid date: ${value}`)
}

assertDate(ledger.generatedAt, 'generatedAt')
assertDate(ledger.showcase.snapshotAt, 'showcase.snapshotAt')

if (
  !closeEnough(
    ledger.showcase.platformFeeRate,
    ledger.methodology.platformFeeRate,
    0.000000001,
  )
) {
  errors.push('showcase: platform fee rate must match methodology')
}
if (
  !closeEnough(
    ledger.showcase.customerShareRate,
    ledger.methodology.defaultCustomerShareRate,
    0.000000001,
  )
) {
  errors.push('showcase: customer share rate must match methodology')
}

const expectedShowcaseEffectiveRate =
  ledger.showcase.platformFeeRate * ledger.showcase.customerShareRate
if (
  !closeEnough(
    ledger.showcase.effectiveRebateRate,
    expectedShowcaseEffectiveRate,
    0.000000001,
  )
) {
  errors.push(
    'showcase: effective rate must equal platform fee rate x customer share rate',
  )
}

const expectedShowcaseRebateUsd =
  ledger.showcase.volumeUsd * ledger.showcase.effectiveRebateRate
if (
  !closeEnough(
    ledger.showcase.estimatedRebateUsd,
    expectedShowcaseRebateUsd,
    0.02,
  )
) {
  errors.push('showcase: estimated rebate must equal volume x effective rate')
}

if (!ledger.showcase.lastMonth.placeholder) {
  errors.push('showcase.lastMonth: unverified earnings must remain a placeholder')
}
assertUnique(
  ledger.customers.map((customer) => customer.publicId),
  'customer publicId',
)
assertUnique(
  ledger.customers.flatMap((customer) => customer.walletLookupHashes),
  'wallet lookup hash',
)
assertUnique(
  ledger.settlements.map((settlement) => settlement.batchId),
  'settlement batchId',
)

const customerIds = new Set(ledger.customers.map((customer) => customer.publicId))

for (const customer of ledger.customers) {
  assertDate(customer.periodStart, `${customer.publicId}.periodStart`)
  assertDate(customer.periodEnd, `${customer.publicId}.periodEnd`)
  assertDate(customer.confirmedAt, `${customer.publicId}.confirmedAt`)
  assertUnique(
    customer.chains.map((chain) => chain.chain),
    `${customer.publicId} chain`,
  )

  for (const chain of customer.chains) {
    const prefix = `${customer.publicId}.${chain.chain}`
    assertDate(chain.snapshotAt, `${prefix}.snapshotAt`)
    assertDate(chain.priceAt, `${prefix}.priceAt`)

    const expectedVolume = chain.closingVolumeNative - chain.openingVolumeNative
    if (!closeEnough(chain.confirmedVolumeNative, expectedVolume, 0.00000001)) {
      errors.push(`${prefix}: confirmed native volume must equal closing minus opening`)
    }

    const expectedEffectiveRate = chain.platformFeeRate * chain.customerShareRate
    if (!closeEnough(chain.effectiveRebateRate, expectedEffectiveRate, 0.000000001)) {
      errors.push(`${prefix}: effective rate must equal platform fee rate x customer share rate`)
    }

    const expectedRebateNative = chain.confirmedVolumeNative * chain.effectiveRebateRate
    if (!closeEnough(chain.estimatedRebateNative, expectedRebateNative, 0.00000001)) {
      errors.push(`${prefix}: native rebate does not match the published formula`)
    }

    const expectedVolumeUsd = chain.confirmedVolumeNative * chain.assetPriceUsd
    if (!closeEnough(chain.confirmedVolumeUsd, expectedVolumeUsd, 0.02)) {
      errors.push(`${prefix}: confirmed USD volume does not match native volume x price`)
    }

    const expectedRebateUsd = chain.estimatedRebateNative * chain.assetPriceUsd
    if (!closeEnough(chain.estimatedRebateUsd, expectedRebateUsd, 0.02)) {
      errors.push(`${prefix}: USD rebate does not match native rebate x price`)
    }

    const hasObservationSource = chain.source.observed !== null
    const hasObservationValues =
      chain.observedVolumeUsd !== null && chain.observedTradeCount !== null
    if (hasObservationSource !== hasObservationValues) {
      errors.push(`${prefix}: observed source, volume and trade count must be published together`)
    }
  }
}

for (const settlement of ledger.settlements) {
  const prefix = settlement.batchId
  if ('placeholder' in settlement) {
    errors.push(`${prefix}: placeholder showcase data must not enter settlements`)
  }
  if (!customerIds.has(settlement.customerPublicId)) {
    errors.push(`${prefix}: references an unknown customer`)
  }
  assertDate(settlement.periodStart, `${prefix}.periodStart`)
  assertDate(settlement.periodEnd, `${prefix}.periodEnd`)
  const finalized = settlement.status === 'paid' || settlement.status === 'adjusted'

  if (!adjustedSettlementHasNote(settlement.status, settlement.note)) {
    errors.push(`${prefix}: adjusted settlement requires a non-empty note`)
  }

  if (finalized) {
    if (
      !settlement.paymentChain ||
      !settlement.paidAsset ||
      settlement.paidAmount === null ||
      settlement.lockedPriceUsd === null ||
      !settlement.paidAt ||
      !settlement.transactionHash
    ) {
      errors.push(`${prefix}: finalized settlement requires payment chain, amount, price, time and tx hash`)
      continue
    }
    assertDate(settlement.paidAt, `${prefix}.paidAt`)
    const expectedPaidUsd = settlement.paidAmount * settlement.lockedPriceUsd
    if (!closeEnough(settlement.paidUsd, expectedPaidUsd, 0.02)) {
      errors.push(`${prefix}: paid USD must equal paid amount x locked price`)
    }
    const evmHash = /^0x[a-fA-F0-9]{64}$/
    const solanaHash = /^[1-9A-HJ-NP-Za-km-z]{32,100}$/
    const hashValid = settlement.paymentChain === 'sol'
      ? solanaHash.test(settlement.transactionHash)
      : evmHash.test(settlement.transactionHash)
    if (!hashValid) errors.push(`${prefix}: transaction hash does not match payment chain`)
    if (settlement.explorerUrl) {
      if (new URL(settlement.explorerUrl).protocol !== 'https:') {
        errors.push(`${prefix}: explorerUrl must use HTTPS`)
      }
      if (
        !explorerUrlContainsTransactionHash(
          settlement.explorerUrl,
          settlement.transactionHash,
        )
      ) {
        errors.push(`${prefix}: explorerUrl must contain the transaction hash`)
      }
      if (
        !explorerUrlMatchesPaymentChain(
          settlement.explorerUrl,
          settlement.paymentChain,
        )
      ) {
        errors.push(`${prefix}: explorerUrl domain does not match payment chain`)
      }
    }
    if (!ledger.isDemo && !settlement.explorerUrl) {
      errors.push(`${prefix}: production finalized settlement requires explorerUrl`)
    }
  } else if (
    settlement.paymentChain !== null ||
    settlement.paidAsset !== null ||
    settlement.paidAmount !== null ||
    settlement.lockedPriceUsd !== null ||
    settlement.paidAt !== null ||
    settlement.transactionHash !== null ||
    settlement.explorerUrl !== null ||
    settlement.paidUsd !== 0
  ) {
    errors.push(`${prefix}: unpaid settlement must not contain payment evidence`)
  }
}

for (const customer of ledger.customers) {
  const estimated = customer.chains.reduce(
    (total, chain) => total + chain.estimatedRebateUsd,
    0,
  )
  const currentPaid = ledger.settlements
    .filter(
      (settlement) =>
        settlement.customerPublicId === customer.publicId &&
        periodsMatch(
          settlement.periodStart,
          settlement.periodEnd,
          customer.periodStart,
          customer.periodEnd,
        ) &&
        (settlement.status === 'paid' || settlement.status === 'adjusted'),
    )
    .reduce((total, settlement) => total + settlement.paidUsd, 0)

  if (currentPaid > estimated + 0.02) {
    errors.push(`${customer.publicId}: current-period payment exceeds estimated rebate`)
  }
  if (customer.settlementStatus === 'paid' && !closeEnough(currentPaid, estimated, 0.02)) {
    errors.push(`${customer.publicId}: paid status requires the current period to be fully paid`)
  }
  if (
    customer.settlementStatus === 'partially_paid' &&
    !(currentPaid > 0 && currentPaid < estimated - 0.02)
  ) {
    errors.push(`${customer.publicId}: partially paid status requires a partial current-period payment`)
  }
  if (
    (customer.settlementStatus === 'awaiting_confirmation' ||
      customer.settlementStatus === 'awaiting_manual_payment') &&
    currentPaid > 0.02
  ) {
    errors.push(`${customer.publicId}: awaiting status cannot have a current-period payment`)
  }
}

const referralsPath = resolve('public/data/referrals.json')
const referrals = referralDirectorySchema.parse(
  JSON.parse(await readFile(referralsPath, 'utf8')),
)
assertDate(referrals.source.checkedAt, 'referrals.source.checkedAt')
assertUnique(referrals.entries.map((entry) => entry.id), 'referral entry id')

for (const entry of referrals.entries) {
  const target = new URL(entry.url)
  if (target.protocol !== 'https:') {
    errors.push(`${entry.id}: referral URL must use HTTPS`)
  }
  if (target.hostname !== entry.targetDomain) {
    errors.push(
      `${entry.id}: targetDomain ${entry.targetDomain} does not match ${target.hostname}`,
    )
  }
}

if (errors.length) {
  console.error(`Ledger validation failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Public data valid: ${ledger.customers.length} customer(s), ${ledger.settlements.length} settlement(s), ${referrals.entries.length} referral link(s), revision ${ledger.ledgerRevision}`,
)
