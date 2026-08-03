import { CircleDollarSign, FileCheck2, ReceiptText, UsersRound } from 'lucide-react'
import { EarningsShowcase } from './EarningsShowcase'
import { formatNumber, formatUsd, pendingRebateUsd, sumChains } from '../lib/ledger'
import type { PublicLedger } from '../lib/schema'

type PublicOverviewProps = {
  ledger: PublicLedger
}

export function PublicOverview({ ledger }: PublicOverviewProps) {
  const totals = ledger.customers.reduce(
    (result, customer) => {
      const customerTotals = sumChains(customer.chains)
      result.volume += customerTotals.confirmedVolumeUsd
      result.pending += pendingRebateUsd(ledger.settlements, customer)
      result.trades += customerTotals.tradeCount
      return result
    },
    { volume: 0, pending: 0, trades: 0 },
  )
  const finalizedSettlements = ledger.settlements.filter(
    (settlement) => settlement.status === 'paid' || settlement.status === 'adjusted',
  )
  const settled = finalizedSettlements
    .reduce((sum, settlement) => sum + settlement.paidUsd, 0)

  return (
    <>
      <section className="public-overview" aria-labelledby="overview-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PUBLIC SUMMARY</p>
            <h2 id="overview-title">公开账本总览</h2>
          </div>
          <p>汇总数据为匿名口径；输入钱包或公开编号后可查看对应明细。</p>
        </div>

        <div className="metrics-band">
          <article className="metric">
            <span className="metric__icon metric__icon--green"><CircleDollarSign size={19} /></span>
            <p>本期确认交易量</p>
            <strong>{formatUsd(totals.volume, 0)}</strong>
            <small>确认口径，详见分链来源</small>
          </article>
          <article className="metric">
            <span className="metric__icon metric__icon--amber"><ReceiptText size={19} /></span>
            <p>待人工结算</p>
            <strong>{formatUsd(totals.pending)}</strong>
            <small>快照价格预估</small>
          </article>
          <article className="metric">
            <span className="metric__icon metric__icon--blue"><FileCheck2 size={19} /></span>
            <p>累计已结算</p>
            <strong>{formatUsd(settled)}</strong>
            <small>{finalizedSettlements.length} 个已完成批次</small>
          </article>
          <article className="metric">
            <span className="metric__icon metric__icon--violet"><UsersRound size={19} /></span>
            <p>API 观察交易</p>
            <strong>{formatNumber(totals.trades, 0)} 笔</strong>
            <small>{ledger.customers.length} 个匿名账户</small>
          </article>
        </div>
      </section>

      <EarningsShowcase showcase={ledger.showcase} ctaHref="./referral.html" />
    </>
  )
}
