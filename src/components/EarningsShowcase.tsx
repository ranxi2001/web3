import {
  ArrowUpRight,
  Calculator,
  CalendarClock,
  Database,
  FileWarning,
  WalletCards,
} from 'lucide-react'
import type { Showcase } from '../lib/schema'

export type EarningsShowcaseData = Showcase

type EarningsShowcaseProps = {
  showcase: EarningsShowcaseData
  ctaHref?: string
  variant?: 'dashboard' | 'referral'
}

export function isEarningsShowcaseData(value: unknown): value is EarningsShowcaseData {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<EarningsShowcaseData>
  const lastMonth = candidate.lastMonth

  return Boolean(
    typeof candidate.id === 'string' &&
      typeof candidate.maskedWallet === 'string' &&
      typeof candidate.network === 'string' &&
      typeof candidate.volumeUsd === 'number' &&
      typeof candidate.platformFeeRate === 'number' &&
      typeof candidate.customerShareRate === 'number' &&
      typeof candidate.effectiveRebateRate === 'number' &&
      typeof candidate.estimatedRebateUsd === 'number' &&
      typeof candidate.snapshotAt === 'string' &&
      typeof candidate.sourceLabel === 'string' &&
      lastMonth &&
      typeof lastMonth.label === 'string' &&
      typeof lastMonth.settledUsd === 'number' &&
      typeof lastMonth.asset === 'string' &&
      typeof lastMonth.placeholder === 'boolean' &&
      typeof lastMonth.note === 'string',
  )
}

function formatCompactUsd(value: number) {
  if (value >= 1_000_000) {
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`
  }
  if (value >= 1_000) {
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1_000)}K`
  }
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`
}

function formatRate(value: number, digits: number) {
  return `${(value * 100).toFixed(digits)}%`
}

function formatAsset(value: number, asset: string, fixed = false) {
  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fixed ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)
  return `${amount} ${asset}`
}

function formatSnapshot(value: string) {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(timestamp)
}

export function EarningsShowcase({
  showcase,
  ctaHref = './referral.html',
  variant = 'dashboard',
}: EarningsShowcaseProps) {
  const estimatedAsset = showcase.lastMonth.asset || 'U'
  const titleId = `earnings-showcase-${showcase.id}`

  return (
    <section
      className={`earnings-showcase earnings-showcase--${variant}`}
      aria-labelledby={titleId}
    >
      <header className="showcase-header">
        <div className="showcase-heading">
          <p className="showcase-eyebrow">
            <span aria-hidden="true" />
            SHARED EARNINGS / CASE 01
          </p>
          <h2 id={titleId}>共享收益如何计算</h2>
          <p>匿名公开口径案例，把交易量、费率和客户份额放在同一条可复核链路中。</p>
        </div>

        <dl className="showcase-identity" aria-label="案例快照信息">
          <div>
            <dt>匿名钱包</dt>
            <dd><WalletCards aria-hidden="true" size={14} />{showcase.maskedWallet}</dd>
          </div>
          <div>
            <dt>网络</dt>
            <dd>{showcase.network}</dd>
          </div>
          <div>
            <dt>快照时间 · 北京</dt>
            <dd>{formatSnapshot(showcase.snapshotAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="showcase-equation" aria-label="收益测算公式">
        <div className="showcase-figure showcase-figure--volume">
          <span>01 / 案例交易量</span>
          <strong>{formatCompactUsd(showcase.volumeUsd)}</strong>
          <small>{showcase.sourceLabel}</small>
        </div>

        <span className="showcase-operator" aria-hidden="true">×</span>

        <div className="showcase-figure showcase-figure--rate">
          <span>02 / 有效返佣率</span>
          <strong>{formatRate(showcase.effectiveRebateRate, 2)}</strong>
          <small>平台费率 × 客户共享比例</small>
        </div>

        <span className="showcase-operator" aria-hidden="true">=</span>

        <div className="showcase-figure showcase-figure--result">
          <span>03 / 累计预计返佣</span>
          <strong>{formatAsset(showcase.estimatedRebateUsd, estimatedAsset, true)}</strong>
          <small>ESTIMATE · 领取前实时核算</small>
        </div>
      </div>

      <div className="showcase-rate-audit">
        <div className="showcase-rate-audit__title">
          <Calculator aria-hidden="true" size={17} />
          <span>费率拆解</span>
        </div>
        <dl>
          <div>
            <dt>平台费率</dt>
            <dd>{formatRate(showcase.platformFeeRate, 2)}</dd>
          </div>
          <span aria-hidden="true">×</span>
          <div>
            <dt>客户共享比例</dt>
            <dd>{formatRate(showcase.customerShareRate, 0)}</dd>
          </div>
          <span aria-hidden="true">=</span>
          <div>
            <dt>有效返佣率</dt>
            <dd>{formatRate(showcase.effectiveRebateRate, 2)}</dd>
          </div>
        </dl>
      </div>

      <footer className="showcase-footer">
        <div className="showcase-last-month">
          <CalendarClock aria-hidden="true" size={20} />
          <div>
            <div className="showcase-last-month__line">
              <span>上月结算 · {showcase.lastMonth.label}</span>
              <strong>
                {formatAsset(
                  showcase.lastMonth.settledUsd,
                  showcase.lastMonth.asset,
                )}
              </strong>
              <em>{showcase.lastMonth.placeholder ? '占位记录' : '已记录'}</em>
            </div>
            <p>{showcase.lastMonth.note}</p>
          </div>
        </div>

        <div className="showcase-disclosure">
          <div>
            <FileWarning aria-hidden="true" size={18} />
            <p>
              累计金额为快照测算；自助领取时按最新汇率确认，实际到账以领取记录与链上交易哈希为准。
            </p>
          </div>
          <a className="showcase-cta" href={ctaHref}>
            查看推荐入口
            <ArrowUpRight aria-hidden="true" size={16} />
          </a>
        </div>
      </footer>

      <p className="showcase-source">
        <Database aria-hidden="true" size={13} />
        CASE {showcase.id} · SOURCE {showcase.sourceLabel}
      </p>
    </section>
  )
}
