import { z } from 'zod'

export const chainIdSchema = z.enum([
  'sol',
  'bsc',
  'base',
  'eth',
  'robinhood',
  'arc',
  'stable',
])

export const chainLedgerSchema = z.object({
  chain: chainIdSchema,
  network: z.string().min(1),
  asset: z.string().min(1),
  openingVolumeNative: z.number().nonnegative(),
  closingVolumeNative: z.number().nonnegative(),
  confirmedVolumeNative: z.number().nonnegative(),
  confirmedVolumeUsd: z.number().nonnegative(),
  observedVolumeUsd: z.number().nonnegative().nullable(),
  observedTradeCount: z.number().int().nonnegative().nullable(),
  platformFeeRate: z.number().min(0).max(1),
  customerShareRate: z.number().min(0).max(1),
  effectiveRebateRate: z.number().min(0).max(1),
  estimatedRebateNative: z.number().nonnegative(),
  estimatedRebateUsd: z.number().nonnegative(),
  assetPriceUsd: z.number().positive(),
  priceAt: z.string().min(1),
  snapshotAt: z.string().min(1),
  status: z.enum(['current', 'delayed', 'manual_review']),
  source: z.object({
    confirmed: z.enum(['gmgn_referral_report', 'manual_adjustment']),
    observed: z.literal('gmgn_portfolio_activity').nullable(),
  }),
})

export const settlementSchema = z.object({
  batchId: z.string().min(1),
  customerPublicId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  chains: z.array(chainIdSchema).min(1),
  calculatedUsd: z.number().nonnegative(),
  paymentChain: chainIdSchema.nullable(),
  paidAsset: z.string().min(1).nullable(),
  paidAmount: z.number().nonnegative().nullable(),
  lockedPriceUsd: z.number().positive().nullable(),
  paidUsd: z.number().nonnegative(),
  paidAt: z.string().min(1).nullable(),
  transactionHash: z.string().min(1).nullable(),
  explorerUrl: z.string().url().nullable(),
  status: z.enum(['confirmed', 'awaiting_transfer', 'paid', 'adjusted']),
  note: z.string().min(1).nullable(),
})

export const customerLedgerSchema = z.object({
  publicId: z.string().min(1),
  alias: z.string().min(1),
  visibility: z.literal('pseudonymous'),
  maskedSettlementAddress: z.string().min(1),
  walletLookupHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  confirmedAt: z.string().min(1),
  settlementStatus: z.enum([
    'awaiting_confirmation',
    'awaiting_manual_payment',
    'partially_paid',
    'paid',
  ]),
  chains: z.array(chainLedgerSchema).min(1),
})

export const publicLedgerSchema = z.object({
  schemaVersion: z.literal(1),
  ledgerRevision: z.string().min(1),
  generatedAt: z.string().min(1),
  timezone: z.literal('Asia/Shanghai'),
  isDemo: z.boolean(),
  title: z.string().min(1),
  disclosure: z.string().min(1),
  methodology: z.object({
    platformFeeRate: z.number().min(0).max(1),
    defaultCustomerShareRate: z.number().min(0).max(1),
    formula: z.string().min(1),
    rounding: z.string().min(1),
    priceRule: z.string().min(1),
    revisionRule: z.string().min(1),
  }),
  sources: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      role: z.string().min(1),
      url: z.string().url(),
    }),
  ),
  customers: z.array(customerLedgerSchema),
  settlements: z.array(settlementSchema),
})

export type ChainId = z.infer<typeof chainIdSchema>
export type ChainLedger = z.infer<typeof chainLedgerSchema>
export type CustomerLedger = z.infer<typeof customerLedgerSchema>
export type Settlement = z.infer<typeof settlementSchema>
export type PublicLedger = z.infer<typeof publicLedgerSchema>
