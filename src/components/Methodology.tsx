import { forwardRef } from 'react'
import { ArrowUpRight, Database, Download, FileCheck2, ShieldCheck } from 'lucide-react'
import { formatDateTime, formatPercent } from '../lib/ledger'
import type { PublicLedger } from '../lib/schema'

type MethodologyProps = {
  ledger: PublicLedger
}

export const Methodology = forwardRef<HTMLElement, MethodologyProps>(
  function Methodology({ ledger }, ref) {
    return (
      <section className="methodology" id="methodology" ref={ref} aria-labelledby="methodology-title">
        <div className="section-heading section-heading--methodology">
          <div>
            <p className="eyebrow">METHODOLOGY & AUDIT</p>
            <h2 id="methodology-title">三层证据，分别核对。</h2>
          </div>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}data/ledger.json`} download>
            <Download size={17} />下载公开 JSON
          </a>
        </div>

        <div className="evidence-flow">
          <article>
            <span className="evidence-flow__index">01</span>
            <Database size={20} />
            <h3>钱包活动观察</h3>
            <p>使用 GMGN Portfolio Activity 按周期汇总买卖的 cost_usd 与去重交易笔数。</p>
            <small>用于交叉核对，不证明推荐归因</small>
          </article>
          <article>
            <span className="evidence-flow__index">02</span>
            <FileCheck2 size={20} />
            <h3>推荐报告确认</h3>
            <p>运营登录 GMGN Referral Report，确认客户归因、交易量与本期可结算口径。</p>
            <small>当前返佣计算的确认来源</small>
          </article>
          <article>
            <span className="evidence-flow__index">03</span>
            <ShieldCheck size={20} />
            <h3>人工付款凭证</h3>
            <p>转账后记录批次、锁价、实付币种数量、时间与可验证的链上交易哈希。</p>
            <small>用于证明实际完成结算</small>
          </article>
        </div>

        <div className="methodology-grid">
          <div className="formula-panel">
            <p className="eyebrow">CALCULATION</p>
            <h3>返佣公式</h3>
            <div className="formula-panel__equation">
              <span>确认交易量</span><b>×</b><span>{formatPercent(ledger.methodology.platformFeeRate, 0)} 手续费</span>
              <b>×</b><span>{formatPercent(ledger.methodology.defaultCustomerShareRate, 0)} 客户分成</span>
              <b>=</b><strong>{formatPercent(ledger.methodology.platformFeeRate * ledger.methodology.defaultCustomerShareRate)} 有效返佣率</strong>
            </div>
            <p>{ledger.methodology.priceRule}</p>
            <p>{ledger.methodology.rounding}</p>
          </div>

          <div className="source-list">
            <p className="eyebrow">SOURCES</p>
            <h3>公开来源</h3>
            {ledger.sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer noopener">
                <span><strong>{source.label}</strong><small>{source.role}</small></span>
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
        </div>

        <div className="audit-meta">
          <span>Schema v{ledger.schemaVersion}</span>
          <span>修订 {ledger.ledgerRevision}</span>
          <span>生成于 {formatDateTime(ledger.generatedAt)}</span>
          <span>{ledger.methodology.revisionRule}</span>
          <span>匿名编号与钱包哈希不等于身份鉴权</span>
        </div>
      </section>
    )
  },
)
