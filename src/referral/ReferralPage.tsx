import {
  ArrowRight,
  Check,
  Copy,
  Database,
  ExternalLink,
  Globe2,
  LoaderCircle,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  isEarningsShowcaseData,
  type EarningsShowcaseData,
} from '../components/EarningsShowcase'

type Category = 'exchange' | 'web3' | 'card'
type CategoryFilter = 'all' | Category
type DomainKind = 'official' | 'partner'

interface SourceItem {
  id: string
  title: string
}

interface ReferralEntry {
  id: string
  platform: string
  title: string
  category: Category
  benefit: string
  url: string
  targetDomain: string
  domainKind: DomainKind
  referralCode: string
  iconUrl: string
  sourceItems: SourceItem[]
}

interface ReferralDirectory {
  version: number
  source: {
    provider: string
    page: string
    okxMaterialPage: string
    checkedAt: string
    pageBuildId: string
  }
  entries: ReferralEntry[]
}

const FILTERS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'exchange', label: '交易所' },
  { value: 'web3', label: 'Web3' },
  { value: 'card', label: '支付卡' },
]

const CATEGORY_LABELS: Record<Category, string> = {
  exchange: '中心化交易所',
  web3: '链上与钱包',
  card: '支付卡',
}

const VOLUME_STEPS = [25_000, 75_000, 150_000, 300_000, 600_000]

function isReferralDirectory(value: unknown): value is ReferralDirectory {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<ReferralDirectory>
  return Boolean(
    candidate.source &&
      typeof candidate.source.page === 'string' &&
      typeof candidate.source.okxMaterialPage === 'string' &&
      typeof candidate.source.checkedAt === 'string' &&
      Array.isArray(candidate.entries) &&
      candidate.entries.every(
        (entry) =>
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.platform === 'string' &&
          typeof entry.url === 'string' &&
          typeof entry.targetDomain === 'string' &&
          Array.isArray(entry.sourceItems),
      ),
  )
}

function formatCompactUsd(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()

  if (!copied) throw new Error('Clipboard API unavailable')
}

function LoadingState() {
  return (
    <main className="referral-state" aria-live="polite">
      <LoaderCircle aria-hidden="true" className="spin" size={22} />
      <p>正在读取公开推荐目录…</p>
    </main>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="referral-state referral-state--error" role="alert">
      <Database aria-hidden="true" size={24} />
      <h1>推荐目录暂时不可用</h1>
      <p>{message}</p>
      <a href="./referral.html">重新载入</a>
    </main>
  )
}

function RebateMotion({ effectiveRate }: { effectiveRate: number }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const interval = window.setInterval(() => {
      setStep((current) => (current + 1) % VOLUME_STEPS.length)
    }, 1600)

    return () => window.clearInterval(interval)
  }, [])

  const volume = VOLUME_STEPS[step]
  const estimatedRebate = volume * effectiveRate

  return (
    <section className="rebate-motion" aria-labelledby="rebate-motion-title">
      <div className="rebate-motion__intro">
        <span className="rebate-motion__kicker">
          <TrendingUp aria-hidden="true" size={15} />
          月度返佣测算
        </span>
        <h1 id="rebate-motion-title">交易量增长，返佣同步增长</h1>
        <p>按 {(effectiveRate * 100).toFixed(2)}% 有效返佣率预计</p>
      </div>

      <div className="rebate-motion__metrics">
        <div className="rebate-motion__metric">
          <span>月交易量</span>
          <strong key={`volume-${step}`}>{formatCompactUsd(volume)}</strong>
        </div>
        <ArrowRight className="rebate-motion__arrow" aria-hidden="true" size={22} />
        <div className="rebate-motion__metric rebate-motion__metric--result">
          <span>预计月返佣</span>
          <strong key={`rebate-${step}`}>{formatCompactUsd(estimatedRebate)}</strong>
        </div>
        <div className="rebate-motion__bars" aria-hidden="true">
          {VOLUME_STEPS.map((item, index) => (
            <span className={index <= step ? 'is-active' : ''} key={item} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function ReferralPage() {
  const [directory, setDirectory] = useState<ReferralDirectory | null>(null)
  const [showcase, setShowcase] = useState<EarningsShowcaseData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadDirectory() {
      try {
        const response = await fetch('./data/referrals.json', {
          cache: 'no-cache',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`数据请求失败（HTTP ${response.status}）`)

        const payload: unknown = await response.json()
        if (!isReferralDirectory(payload)) throw new Error('公开推荐目录格式无效')
        setDirectory(payload)
      } catch (error) {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : '无法读取公开推荐目录')
      }
    }

    async function loadShowcase() {
      try {
        const response = await fetch('./data/ledger.json', {
          cache: 'no-cache',
          signal: controller.signal,
        })
        if (!response.ok) return

        const payload: unknown = await response.json()
        if (!payload || typeof payload !== 'object') return

        const candidate = (payload as { showcase?: unknown }).showcase
        if (isEarningsShowcaseData(candidate)) setShowcase(candidate)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Unable to load earnings showcase', error)
        }
      }
    }

    void loadDirectory()
    void loadShowcase()
    return () => controller.abort()
  }, [])

  const visibleEntries = useMemo(() => {
    if (!directory) return []
    if (activeCategory === 'all') return directory.entries
    return directory.entries.filter((entry) => entry.category === activeCategory)
  }, [activeCategory, directory])

  async function handleCopy(entry: ReferralEntry) {
    try {
      await copyToClipboard(entry.referralCode)
      setCopiedId(entry.id)
      setCopyMessage(`${entry.platform} 邀请码已复制`)
      window.setTimeout(() => setCopiedId(null), 1800)
    } catch {
      setCopyMessage('复制失败，请手动选择邀请码')
    }
  }

  if (loadError) return <ErrorState message={loadError} />
  if (!directory) return <LoadingState />

  return (
    <div className="referral-shell">
      <header className="referral-topbar">
        <a className="referral-brand" href="./" aria-label="返回返佣公开账本">
          <img
            className="referral-brand__mark"
            src={`${import.meta.env.BASE_URL}brand-mark.svg`}
            alt=""
          />
          <span>
            <strong>返佣公开账本</strong>
            <small>REBATE LEDGER</small>
          </span>
        </a>

        <nav className="referral-nav" aria-label="主导航">
          <a href="./">
            <Database aria-hidden="true" size={15} />
            返佣看板
          </a>
          <a href="./referral.html" aria-current="page">推荐入口</a>
        </nav>
      </header>

      <main>
        <RebateMotion effectiveRate={showcase?.effectiveRebateRate ?? 0.003} />

        <section className="referral-directory" aria-labelledby="directory-heading">
          <div className="directory-toolbar">
            <div>
              <span className="directory-kicker">注册入口</span>
              <h2 id="directory-heading">选择平台，立即注册</h2>
            </div>

            <div className="category-filter" aria-label="按入口类型筛选">
              {FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  className={activeCategory === filter.value ? 'is-active' : ''}
                  aria-pressed={activeCategory === filter.value}
                  onClick={() => setActiveCategory(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="directory-table" aria-label="推荐入口列表">
            <div className="directory-columns" aria-hidden="true">
              <span>平台</span>
              <span>权益 / 邀请码</span>
              <span>目标域名</span>
              <span>注册</span>
            </div>

            <div className="directory-rows">
              {visibleEntries.map((entry) => {
                const copied = copiedId === entry.id
                return (
                  <article className="referral-entry" key={entry.id}>
                    <div className="entry-brand">
                      <span className="entry-logo" aria-hidden="true">
                        <span>{entry.platform.slice(0, 2).toUpperCase()}</span>
                        <img src={entry.iconUrl} alt="" loading="lazy" />
                      </span>
                      <div>
                        <div className="entry-platform-line">
                          <strong>{entry.platform}</strong>
                          <span>{CATEGORY_LABELS[entry.category]}</span>
                        </div>
                        <h3>{entry.title}</h3>
                      </div>
                    </div>

                    <div className="entry-reward">
                      <p>{entry.benefit}</p>
                      <div className="referral-code">
                        <span>邀请码</span>
                        <code>{entry.referralCode}</code>
                        <button
                          type="button"
                          className="copy-button"
                          aria-label={`复制 ${entry.platform} 邀请码 ${entry.referralCode}`}
                          title={copied ? '已复制' : '复制邀请码'}
                          onClick={() => void handleCopy(entry)}
                        >
                          {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="entry-destination">
                      <div className="domain-line">
                        <Globe2 aria-hidden="true" size={15} />
                        <span>{entry.targetDomain}</span>
                      </div>
                      <span className={`domain-badge domain-badge--${entry.domainKind}`}>
                        {entry.domainKind === 'official' ? '官方域名' : '推广跳转'}
                      </span>
                    </div>

                    <div className="entry-action">
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        aria-label={`前往 ${entry.platform}，将在新标签页打开`}
                      >
                        立即注册
                        <ExternalLink aria-hidden="true" size={15} />
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <p className="directory-result" aria-live="polite">
            当前显示 {visibleEntries.length} / {directory.entries.length} 个入口
          </p>
          <p className="sr-only" aria-live="polite">{copyMessage}</p>
        </section>
      </main>

      <footer className="referral-footer">
        <span>返佣公开账本 / REBATE LEDGER</span>
        <span>DATA VERSION {directory.version} · SOURCE BUILD {directory.source.pageBuildId}</span>
      </footer>
    </div>
  )
}
