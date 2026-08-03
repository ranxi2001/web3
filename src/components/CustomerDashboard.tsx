import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  FileClock,
  Gauge,
  History,
  Info,
  Layers3,
  ReceiptText,
  Share2,
  TriangleAlert,
} from 'lucide-react'
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatUsd,
  getFreshness,
  paidUsdForCurrentPeriod,
  pendingRebateUsd,
  settledUsdForCustomer,
  settlementsForCustomer,
  shortHash,
  sumChains,
} from '../lib/ledger'
import type { ChainLedger, CustomerLedger, PublicLedger } from '../lib/schema'

type DashboardView = 'chains' | 'settlements' | 'notes'
type ChainFilter = 'all' | 'current' | 'attention'

type CustomerDashboardProps = {
  ledger: PublicLedger
  customer: CustomerLedger
}

const chainShortName: Record<ChainLedger['chain'], string> = {
  sol: 'SOL',
  bsc: 'BNB',
  base: 'BASE',
  eth: 'ETH',
  robinhood: 'R',
  arc: 'ARC',
  stable: 'ST',
}

const settlementStatus = {
  awaiting_confirmation: ['待确认', 'neutral'],
  awaiting_manual_payment: ['待人工转账', 'pending'],
  partially_paid: ['部分结算', 'warning'],
  paid: ['已结算', 'success'],
} as const

const chainStatus = {
  current: ['数据完整', 'success'],
  delayed: ['数据延迟', 'warning'],
  manual_review: ['人工复核', 'pending'],
} as const

const recordStatus = {
  confirmed: ['已确认', 'neutral'],
  awaiting_transfer: ['待人工转账', 'pending'],
  paid: ['已支付', 'success'],
  adjusted: ['已调整', 'warning'],
} as const

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>
}

function ChainRow({ chain }: { chain: ChainLedger }) {
  const [expanded, setExpanded] = useState(false)
  const [statusLabel, statusTone] = chainStatus[chain.status]
  const difference =
    chain.observedVolumeUsd === null || chain.confirmedVolumeUsd === 0
      ? null
      : (chain.observedVolumeUsd - chain.confirmedVolumeUsd) / chain.confirmedVolumeUsd
  const confirmedSourceLabel =
    chain.source.confirmed === 'gmgn_referral_report' ? '推荐报告确认' : '人工调整确认'
  const observedSourceLabel = chain.source.observed ? 'API 观察' : '未接入 API'

  return (
    <article className={`chain-row chain-row--${chain.chain}`}>
      <div className="chain-row__summary">
        <div className="chain-name" data-label="网络">
          <span className="chain-mark" aria-hidden="true">{chainShortName[chain.chain]}</span>
          <span>
            <strong>{chain.network}</strong>
            <small>{chain.asset} 结算资产</small>
          </span>
        </div>
        <div className="chain-cell" data-label="快照截止">
          <strong>{formatDateTime(chain.snapshotAt)}</strong>
          <small>{confirmedSourceLabel} + {observedSourceLabel}</small>
        </div>
        <div className="chain-cell numeric" data-label="确认交易量">
          <strong>{formatUsd(chain.confirmedVolumeUsd)}</strong>
          <small>{formatNumber(chain.confirmedVolumeNative)} {chain.asset}</small>
        </div>
        <div className="chain-cell numeric" data-label="API 观察量">
          <strong>
            {chain.observedVolumeUsd === null ? '未同步' : formatUsd(chain.observedVolumeUsd)}
          </strong>
          <small>
            {chain.observedTradeCount === null
              ? '无交易笔数'
              : `${formatNumber(chain.observedTradeCount, 0)} 笔`}
            {difference !== null && ` · 差异 ${formatPercent(difference)}`}
          </small>
        </div>
        <div className="chain-cell numeric" data-label="有效返佣率">
          <strong>{formatPercent(chain.effectiveRebateRate)}</strong>
          <small>客户分成 {formatPercent(chain.customerShareRate, 0)}</small>
        </div>
        <div className="chain-cell numeric chain-cell--rebate" data-label="本期预估返佣">
          <strong>{formatUsd(chain.estimatedRebateUsd)}</strong>
          <small>{formatNumber(chain.estimatedRebateNative, 8)} {chain.asset}</small>
        </div>
        <div className="chain-row__actions" data-label="状态">
          <StatusBadge label={statusLabel} tone={statusTone} />
          <button
            className="icon-button"
            type="button"
            aria-label={expanded ? '收起计算明细' : '展开计算明细'}
            aria-expanded={expanded}
            data-tooltip={expanded ? '收起明细' : '计算明细'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="chain-detail">
          <div className="chain-detail__formula">
            <span>公开计算</span>
            <p>
              {formatNumber(chain.confirmedVolumeNative)} {chain.asset}
              <b> × </b>{formatPercent(chain.platformFeeRate, 0)} 手续费
              <b> × </b>{formatPercent(chain.customerShareRate, 0)} 分成
              <b> = </b>{formatNumber(chain.estimatedRebateNative, 8)} {chain.asset}
            </p>
          </div>
          <dl>
            <div><dt>期初累计</dt><dd>{formatNumber(chain.openingVolumeNative)} {chain.asset}</dd></div>
            <div><dt>期末累计</dt><dd>{formatNumber(chain.closingVolumeNative)} {chain.asset}</dd></div>
            <div><dt>本期增量</dt><dd>{formatNumber(chain.confirmedVolumeNative)} {chain.asset}</dd></div>
            <div><dt>估值价格</dt><dd>{formatUsd(chain.assetPriceUsd)} / {chain.asset}</dd></div>
            <div><dt>价格时间</dt><dd>{formatDateTime(chain.priceAt)}</dd></div>
            <div><dt>确认来源</dt><dd>{confirmedSourceLabel}</dd></div>
          </dl>
        </div>
      )}
    </article>
  )
}

export function CustomerDashboard({ ledger, customer }: CustomerDashboardProps) {
  const [view, setView] = useState<DashboardView>('chains')
  const [filter, setFilter] = useState<ChainFilter>('all')
  const [copied, setCopied] = useState<string | null>(null)
  const totals = sumChains(customer.chains)
  const settlements = settlementsForCustomer(ledger.settlements, customer)
  const settledUsd = settledUsdForCustomer(ledger.settlements, customer)
  const currentPeriodPaidUsd = paidUsdForCurrentPeriod(ledger.settlements, customer)
  const pendingUsd = pendingRebateUsd(ledger.settlements, customer)
  const lastSettlement = settlements.find(
    (item) => item.status === 'paid' || item.status === 'adjusted',
  )
  const freshness = getFreshness(customer.chains)
  const confirmedSources = new Set(
    customer.chains.map((chain) => chain.source.confirmed),
  )
  const confirmationSummary = confirmedSources.has('manual_adjustment')
    ? confirmedSources.has('gmgn_referral_report')
      ? '本期各链数据完整；确认来源包含 GMGN 推荐报告与公开人工调整。'
      : '本期各链数据完整；确认量来自公开人工调整。'
    : '本期各链数据完整，已完成 GMGN 推荐报告复核。'
  const [settlementLabel, settlementTone] = settlementStatus[customer.settlementStatus]

  const visibleChains = useMemo(
    () =>
      customer.chains.filter((chain) => {
        if (filter === 'all') return true
        if (filter === 'current') return chain.status === 'current'
        return chain.status !== 'current'
      }),
    [customer.chains, filter],
  )

  const copyText = async (value: string, key: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const input = document.createElement('textarea')
      input.value = value
      input.readOnly = true
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.append(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1800)
  }

  const share = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('account', customer.publicId)
    if (navigator.share) {
      await navigator.share({ title: `${customer.alias} 返佣账本`, url: url.toString() })
      return
    }
    await copyText(url.toString(), 'share')
  }

  return (
    <section className="customer-ledger" id="customer-ledger" aria-labelledby="customer-title">
      <div className="account-heading">
        <div className="account-heading__identity">
          <p className="eyebrow">CUSTOMER LEDGER</p>
          <div>
            <h2 id="customer-title">{customer.alias}</h2>
            <StatusBadge label={settlementLabel} tone={settlementTone} />
          </div>
          <p>
            <span>{customer.publicId}</span>
            <span className="dot-separator">·</span>
            <span>{customer.maskedSettlementAddress}</span>
          </p>
        </div>
        <div className="account-heading__actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void copyText(customer.publicId, 'id')}
          >
            {copied === 'id' ? <Check size={17} /> : <Copy size={17} />}
            {copied === 'id' ? '已复制' : '复制编号'}
          </button>
          <button className="secondary-button" type="button" onClick={() => void share()}>
            {copied === 'share' ? <Check size={17} /> : <Share2 size={17} />}
            {copied === 'share' ? '链接已复制' : '分享账本'}
          </button>
        </div>
      </div>

      <div className={`ledger-health ledger-health--${freshness}`}>
        {freshness === 'current' ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
        <span>
          {freshness === 'current'
            ? confirmationSummary
            : '部分链存在数据延迟或待复核，请以分链状态为准。'}
        </span>
        <small>
          周期 {formatDate(customer.periodStart)} - {formatDate(customer.periodEnd)} · 确认于{' '}
          {formatDateTime(customer.confirmedAt)}
        </small>
      </div>

      <div className="metrics-band metrics-band--customer">
        <article className="metric metric--primary">
          <span className="metric__icon metric__icon--amber"><ReceiptText size={19} /></span>
          <p>待结算返佣（预估）</p>
          <strong>{formatUsd(pendingUsd)}</strong>
          <small>
            {currentPeriodPaidUsd > 0
              ? `本期已支付 ${formatUsd(currentPeriodPaidUsd)}`
              : '实际支付按人工结算锁价'}
          </small>
        </article>
        <article className="metric">
          <span className="metric__icon metric__icon--green"><Gauge size={19} /></span>
          <p>本期确认交易量</p>
          <strong>{formatUsd(totals.confirmedVolumeUsd, 0)}</strong>
          <small>API 观察 {formatUsd(totals.observedVolumeUsd, 0)}</small>
        </article>
        <article className="metric">
          <span className="metric__icon metric__icon--blue"><History size={19} /></span>
          <p>累计已结算</p>
          <strong>{formatUsd(settledUsd)}</strong>
          <small>{settlements.length} 个历史批次</small>
        </article>
        <article className="metric">
          <span className="metric__icon metric__icon--violet"><FileClock size={19} /></span>
          <p>最近一次结算</p>
          <strong>{lastSettlement?.paidAt ? formatDate(lastSettlement.paidAt) : '暂无'}</strong>
          <small>
            {lastSettlement?.paidAmount != null && lastSettlement.paidAsset
              ? `${formatNumber(lastSettlement.paidAmount)} ${lastSettlement.paidAsset}`
              : '无结算记录'}
          </small>
        </article>
      </div>

      <div className="view-toolbar">
        <div className="segmented-control" aria-label="账本视图">
          <button className={view === 'chains' ? 'is-active' : ''} type="button" onClick={() => setView('chains')}>
            <Layers3 size={16} />分链明细
          </button>
          <button className={view === 'settlements' ? 'is-active' : ''} type="button" onClick={() => setView('settlements')}>
            <History size={16} />结算记录
          </button>
          <button className={view === 'notes' ? 'is-active' : ''} type="button" onClick={() => setView('notes')}>
            <Info size={16} />账户说明
          </button>
        </div>
        {view === 'chains' && (
          <label className="compact-select">
            <span>状态筛选</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as ChainFilter)}>
              <option value="all">全部链</option>
              <option value="current">数据完整</option>
              <option value="attention">需要关注</option>
            </select>
          </label>
        )}
      </div>

      {view === 'chains' && (
        <div className="chain-table" aria-label="分链返佣明细">
          <div className="chain-table__head" aria-hidden="true">
            <span>网络</span><span>快照截止</span><span>确认交易量</span><span>API 观察量</span>
            <span>有效返佣率</span><span>本期预估返佣</span><span>状态</span>
          </div>
          <div className="chain-table__body">
            {visibleChains.map((chain) => <ChainRow key={chain.chain} chain={chain} />)}
          </div>
          <div className="chain-total">
            <span>全链合计</span>
            <span>{formatUsd(totals.confirmedVolumeUsd)}</span>
            <strong>{formatUsd(pendingUsd)}</strong>
          </div>
        </div>
      )}

      {view === 'settlements' && (
        <div className="settlement-table-wrap">
          <table className="settlement-table">
            <thead>
              <tr>
                <th>批次 / 覆盖周期</th><th>包含链</th><th>核算金额</th><th>实际支付</th>
                <th>支付时间</th><th>状态</th><th>交易凭证</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => {
                const [recordLabel, recordTone] = recordStatus[settlement.status]
                const hasPayment =
                  settlement.paidAmount !== null &&
                  settlement.paidAsset !== null &&
                  settlement.lockedPriceUsd !== null

                return (
                <tr key={settlement.batchId}>
                  <td data-label="批次 / 覆盖周期">
                    <strong>{settlement.batchId}</strong>
                    <small>{formatDate(settlement.periodStart)} - {formatDate(settlement.periodEnd)}</small>
                    {settlement.note && <small className="settlement-note">{settlement.note}</small>}
                  </td>
                  <td data-label="包含链">{settlement.chains.map((chain) => chain.toUpperCase()).join(' · ')}</td>
                  <td data-label="核算金额" className="numeric">{formatUsd(settlement.calculatedUsd)}</td>
                  <td data-label="实际支付" className="numeric">
                    {hasPayment ? (
                      <>
                        <strong>{formatNumber(settlement.paidAmount!, 8)} {settlement.paidAsset}</strong>
                        <small>
                          {settlement.paymentChain?.toUpperCase()} · @ {formatUsd(settlement.lockedPriceUsd!)}
                        </small>
                      </>
                    ) : (
                      <span className="muted-value">尚未支付</span>
                    )}
                  </td>
                  <td data-label="支付时间">
                    {settlement.paidAt ? formatDateTime(settlement.paidAt) : '待人工转账'}
                  </td>
                  <td data-label="状态"><StatusBadge label={recordLabel} tone={recordTone} /></td>
                  <td data-label="交易凭证">
                    <div className="tx-actions">
                      {settlement.transactionHash ? (
                        <>
                          <code>{shortHash(settlement.transactionHash)}</code>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`复制 ${settlement.batchId} 交易哈希`}
                            data-tooltip={copied === settlement.batchId ? '已复制' : '复制哈希'}
                            onClick={() => void copyText(settlement.transactionHash!, settlement.batchId)}
                          >
                            {copied === settlement.batchId ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </>
                      ) : (
                        <span className="muted-value">待录入</span>
                      )}
                      {settlement.explorerUrl && (
                        <a
                          className="icon-button"
                          href={settlement.explorerUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label="在区块浏览器查看"
                          data-tooltip="区块浏览器"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'notes' && (
        <div className="account-notes">
          <div>
            <span>01</span>
            <h3>确认量与观察量分开</h3>
            <p>确认交易量来自 GMGN 推荐报告或公开调整；API 观察量来自钱包活动汇总，仅作为交叉核对。</p>
          </div>
          <div>
            <span>02</span>
            <h3>人工转账不在网页执行</h3>
            <p>运营复核后人工付款。完成后追加批次、锁价、实付数量与链上交易哈希。</p>
          </div>
          <div>
            <span>03</span>
            <h3>历史记录只追加</h3>
            <p>若发生差异，以调整批次记录原因，不覆盖旧付款凭证，便于长期核对。</p>
          </div>
          <a href="#methodology" onClick={() => setView('chains')}>
            查看完整数据口径 <ArrowUpRight size={16} />
          </a>
        </div>
      )}
    </section>
  )
}
