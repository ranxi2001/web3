import type { FormEvent } from 'react'
import { ArrowRight, ExternalLink, Hash, LoaderCircle, Search, ShieldCheck, Wallet } from 'lucide-react'

type SearchPanelProps = {
  query: string
  busy: boolean
  error: string | null
  showDemo: boolean
  onQueryChange: (value: string) => void
  onSubmit: (query: string) => void
}

export const DEMO_WALLET = '0x1111111111111111111111111111111111111111'

export function SearchPanel({
  query,
  busy,
  error,
  showDemo,
  onQueryChange,
  onSubmit,
}: SearchPanelProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(query)
  }

  return (
    <section className="search-section" aria-labelledby="lookup-title">
      <div className="search-section__intro">
        <p className="eyebrow">GMGN REBATE · PUBLIC LEDGER</p>
        <div className="hero-rate" aria-label="GMGN 手续费返佣比例 30%">
          <span>GMGN 手续费返佣</span>
          <strong>30%</strong>
        </div>
        <h1 id="lookup-title">交易照常，手续费返你 30%。</h1>
        <p>
          通过专属入口使用 GMGN，平台手续费的 30% 返还给你。公开账本可查询交易量、返佣计算与结算记录。
        </p>
        <div className="hero-actions">
          <a className="hero-cta" href="https://gmgn.ai/r/cLf0ZwzZ" target="_blank" rel="noopener noreferrer sponsored">
            立即使用 GMGN
            <ExternalLink size={17} aria-hidden="true" />
          </a>
          <a className="hero-secondary" href="./referral.html">查看全部返佣入口</a>
        </div>
      </div>

      <form className="lookup-form" onSubmit={submit} noValidate>
        <label htmlFor="wallet-query">钱包地址 / 公开编号</label>
        <div className={`lookup-form__control${error ? ' has-error' : ''}`}>
          <Search aria-hidden="true" size={21} />
          <input
            id="wallet-query"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="0x... / Solana 地址 / RL-XXXX-XXX"
            spellCheck={false}
            autoComplete="off"
            aria-describedby="lookup-privacy lookup-error"
            aria-invalid={Boolean(error)}
          />
          <button className="primary-button" type="submit" disabled={busy || !query.trim()}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
            {busy ? '核对中' : '查询账本'}
          </button>
        </div>
        <div className="lookup-form__meta">
          <p id="lookup-privacy">
            <ShieldCheck size={15} aria-hidden="true" />
            地址仅在浏览器内哈希匹配；公开站点不提供私密访问控制。
          </p>
          {showDemo && (
            <>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  onQueryChange(DEMO_WALLET)
                  onSubmit(DEMO_WALLET)
                }}
              >
                <Wallet size={15} aria-hidden="true" />
                使用演示钱包
              </button>
              <span className="lookup-form__divider" aria-hidden="true" />
              <span>
                <Hash size={15} aria-hidden="true" />
                演示编号 RL-8F2K-91Q
              </span>
            </>
          )}
        </div>
        <p className="form-error" id="lookup-error" role="alert">
          {error}
        </p>
      </form>
    </section>
  )
}
