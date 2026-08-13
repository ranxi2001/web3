import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react'
import { CustomerDashboard } from './components/CustomerDashboard'
import { Methodology } from './components/Methodology'
import { PublicOverview } from './components/PublicOverview'
import { SearchPanel } from './components/SearchPanel'
import { SiteHeader } from './components/SiteHeader'
import { findCustomer, looksLikeWalletAddress } from './lib/ledger'
import { publicLedgerSchema, type CustomerLedger, type PublicLedger } from './lib/schema'

function App() {
  const [ledger, setLedger] = useState<PublicLedger | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLedger | null>(null)
  const [query, setQuery] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const methodologyRef = useRef<HTMLElement>(null)

  const loadLedger = useCallback(async () => {
    setLoadError(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/ledger.json`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const parsed = publicLedgerSchema.parse(await response.json())
      setLedger(parsed)

      const account = new URLSearchParams(window.location.search).get('account')
      if (account) {
        const customer = parsed.customers.find(
          (item) => item.publicId.toLowerCase() === account.toLowerCase(),
        )
        if (customer) {
          setQuery(customer.publicId)
          setSelectedCustomer(customer)
        }
      }
    } catch (error) {
      console.error(error)
      setLoadError('公开账本暂时无法读取，请稍后刷新。')
    }
  }, [])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger])

  const search = useCallback(
    async (input: string) => {
      if (!ledger) return
      const trimmed = input.trim()
      setSearchError(null)
      const clearAccountParam = () => {
        const url = new URL(window.location.href)
        url.searchParams.delete('account')
        window.history.replaceState({}, '', url)
      }

      const isPublicId = /^RL-[A-Z0-9-]{5,}$/i.test(trimmed)
      if (!isPublicId && !looksLikeWalletAddress(trimmed)) {
        setSelectedCustomer(null)
        clearAccountParam()
        setSearchError('请输入完整 EVM / Solana 钱包地址，或 RL 开头的公开编号。')
        return
      }

      setSearchBusy(true)
      try {
        const customer = await findCustomer(ledger, trimmed)
        if (!customer) {
          setSelectedCustomer(null)
          clearAccountParam()
          setSearchError('未找到对应账本。请核对地址，或联系运营人员确认公开编号。')
          return
        }
        setSelectedCustomer(customer)
        setQuery(customer.publicId)
        const url = new URL(window.location.href)
        url.searchParams.set('account', customer.publicId)
        window.history.replaceState({}, '', url)
        window.requestAnimationFrame(() => {
          document.getElementById('customer-ledger')?.scrollIntoView({ behavior: 'smooth' })
        })
      } finally {
        setSearchBusy(false)
      }
    },
    [ledger],
  )

  const scrollToMethodology = () => {
    methodologyRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <SiteHeader generatedAt={ledger?.generatedAt} onMethodology={scrollToMethodology} />
      <main>
        {ledger?.isDemo && (
          <div className="demo-notice" role="status">
            <span>数据状态</span>
            账本查询当前展示脱敏样例；返佣比例与计算口径可正常查看。
          </div>
        )}

        <SearchPanel
          query={query}
          busy={searchBusy}
          error={searchError}
          showDemo={Boolean(ledger?.isDemo)}
          onQueryChange={(value) => {
            setQuery(value)
            setSearchError(null)
          }}
          onSubmit={(value) => void search(value)}
        />

        {!ledger && !loadError && (
          <div className="loading-state" aria-live="polite">
            <RefreshCw className="spin" size={22} />
            正在校验公开快照...
          </div>
        )}

        {loadError && (
          <div className="error-state" role="alert">
            <AlertTriangle size={22} />
            <div>
              <strong>{loadError}</strong>
              <button className="text-button" type="button" onClick={() => void loadLedger()}>
                重新读取
              </button>
            </div>
          </div>
        )}

        {ledger && (
          <>
            {selectedCustomer ? (
              <>
                <CustomerDashboard ledger={ledger} customer={selectedCustomer} />
                <section className="claim-entry" aria-labelledby="claim-entry-title">
                  <div>
                    <span><ShieldCheck size={16} aria-hidden="true" />白名单地址保护</span>
                    <h2 id="claim-entry-title">核对完成后，前往返佣中心自助领取</h2>
                    <p>系统自动同步全链数据。领取前会再次确认分链金额、最新汇率与白名单收款地址。</p>
                  </div>
                  <a href="./claim.html">
                    领取全链返佣
                    <ArrowRight size={18} aria-hidden="true" />
                  </a>
                </section>
              </>
            ) : (
              <PublicOverview ledger={ledger} />
            )}
            <Methodology ref={methodologyRef} ledger={ledger} />
          </>
        )}

        <section className="seo-explainer" aria-labelledby="seo-explainer-title">
          <p className="eyebrow">GMGN REBATE GUIDE</p>
          <h2 id="seo-explainer-title">GMGN 30% 返佣如何运作？</h2>
          <p>经 GMGN.BEST 专属入口注册并满足归因条件后，系统自动同步 GMGN 全链交易数据，按已确认的平台手续费计算 30% 返佣。用户绑定白名单收款地址后，可在返佣中心核对分链金额并自助领取。</p>
          <ul>
            <li><strong>返佣对象：</strong>GMGN.BEST 根据自身返佣规则向符合条件的用户返还部分手续费。</li>
            <li><strong>计算口径：</strong>确认交易量 × GMGN 手续费率 × 30%，不是返还交易量的 30%。</li>
            <li><strong>安全边界：</strong>查询和领取不需要提交私钥或助记词；Gas、交易手续费和返佣是不同概念。</li>
          </ul>
          <p>GMGN.BEST 是独立返佣服务，不是 GMGN 官方网站，也不代表 GMGN 官方作出 30% 返还承诺。资格与实际结果受账号归因、活动规则、数据同步和链上状态影响。</p>
          <a href="https://onefly.top/posts/gmgn-referral-code-fee-rebate-guide.html" target="_blank" rel="noopener noreferrer">阅读 GMGN 邀请码、计算规则与领取指南</a>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>GMGN.BEST</strong>
          <span>自动同步 · 自助领取 · 链上凭证</span>
        </div>
        <p>仅向账户主动绑定的白名单地址支付；不会索要钱包私钥或助记词。</p>
      </footer>
    </div>
  )
}

export default App
