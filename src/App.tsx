import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
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
              <CustomerDashboard ledger={ledger} customer={selectedCustomer} />
            ) : (
              <PublicOverview ledger={ledger} />
            )}
            <Methodology ref={methodologyRef} ledger={ledger} />
          </>
        )}
      </main>

      <footer className="site-footer">
        <div>
          <strong>返佣公开账本</strong>
          <span>只读查询 · 人工复核 · 链上凭证</span>
        </div>
        <p>本页不托管资产，不连接钱包，不发起任何交易。</p>
      </footer>
    </div>
  )
}

export default App
