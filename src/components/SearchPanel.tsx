import type { FormEvent } from 'react'
import { ArrowRight, Hash, LoaderCircle, Search, ShieldCheck, Wallet } from 'lucide-react'

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
        <p className="eyebrow">PUBLIC REBATE AUDIT</p>
        <h1 id="lookup-title">查清每一笔交易，核对每一次结算。</h1>
        <p>
          输入客户公开编号或 GMGN 交易钱包，查看本期交易量、返佣计算与历史付款凭证。
        </p>
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
