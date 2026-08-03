import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Globe2,
  Link2,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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

function isReferralDirectory(value: unknown): value is ReferralDirectory {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<ReferralDirectory>
  return Boolean(
    candidate.source &&
      typeof candidate.source.page === 'string' &&
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

function formatCheckedAt(value: string) {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(timestamp)
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

export function ReferralPage() {
  const [directory, setDirectory] = useState<ReferralDirectory | null>(null)
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

    void loadDirectory()
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

  const platformCount = new Set(directory.entries.map((entry) => entry.platform)).size
  const checkedAt = formatCheckedAt(directory.source.checkedAt)

  return (
    <div className="referral-shell">
      <header className="referral-topbar">
        <a className="referral-brand" href="./" aria-label="返回返佣公开账本">
          <span className="referral-brand__mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
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
        <section className="referral-hero" aria-labelledby="referral-title">
          <div className="referral-hero__copy">
            <div className="referral-eyebrow">
              <span className="status-dot" aria-hidden="true" />
              PUBLIC DIRECTORY · READ ONLY
            </div>
            <h1 id="referral-title">推荐入口目录</h1>
            <p>
              集中核对平台入口、目标域名与邀请码。优惠说明按来源页原文整理，实际权益以注册落地页为准。
            </p>
          </div>

          <dl className="referral-summary" aria-label="推荐目录摘要">
            <div>
              <dt>公开入口</dt>
              <dd>{directory.entries.length}</dd>
            </div>
            <div>
              <dt>覆盖平台</dt>
              <dd>{platformCount}</dd>
            </div>
            <div className="referral-summary__wide">
              <dt>最近核对 · 北京时间</dt>
              <dd>{checkedAt}</dd>
            </div>
          </dl>
        </section>

        <section className="security-notice" aria-label="安全提示">
          <ShieldCheck aria-hidden="true" size={22} />
          <div>
            <strong>安全核对</strong>
            <p>
              本页不会连接钱包，也不会索取私钥、助记词或验证码。标记为“推广跳转”的入口使用合作域名，登录、充值或交易前请再次确认最终落地域名。
            </p>
          </div>
        </section>

        <section className="referral-directory" aria-labelledby="directory-heading">
          <div className="directory-toolbar">
            <div>
              <span className="directory-kicker">DIRECTORY / 01</span>
              <h2 id="directory-heading">入口清单</h2>
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
              <span>平台 / 来源记录</span>
              <span>权益 / 邀请码</span>
              <span>目标域名</span>
              <span>访问</span>
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
                        <p className="source-record">
                          SOURCE · {entry.sourceItems.map((item) => item.id).join(' + ')}
                        </p>
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
                        前往
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

        <section className="source-audit" aria-labelledby="source-heading">
          <div className="source-audit__heading">
            <Database aria-hidden="true" size={20} />
            <div>
              <span>PROVENANCE / 02</span>
              <h2 id="source-heading">来源与更新</h2>
            </div>
          </div>

          <div className="source-audit__grid">
            <div>
              <h3>公开来源</h3>
              <a
                href={directory.source.page}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Link2 aria-hidden="true" size={15} />
                vlink.cc/tosky
                <ExternalLink aria-hidden="true" size={14} />
              </a>
              <p>页面记录保留 VLink 原始条目 ID，便于逐项复核。</p>
            </div>
            <div>
              <h3>静态快照</h3>
              <p>核对时间：{checkedAt}。目录随数据文件更新，不代表平台条款实时不变。</p>
            </div>
            <div>
              <h3>结算边界</h3>
              <p>本页仅提供推荐入口；返佣统计与人工转账结算请返回公开账本查看。</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="referral-footer">
        <span>返佣公开账本 / REBATE LEDGER</span>
        <span>DATA VERSION {directory.version} · SOURCE BUILD {directory.source.pageBuildId}</span>
      </footer>
    </div>
  )
}
