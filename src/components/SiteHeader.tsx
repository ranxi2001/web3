import { ArrowUpRight, BookOpenText, Database, Link2 } from 'lucide-react'
import { formatDateTime } from '../lib/ledger'

type SiteHeaderProps = {
  generatedAt?: string
  onMethodology: () => void
}

export function SiteHeader({ generatedAt, onMethodology }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href="./index.html" aria-label="GMGN.BEST 首页">
          <img
            className="brand__mark"
            src={`${import.meta.env.BASE_URL}gmgn-frog-coin.webp`}
            alt=""
          />
          <span className="brand__name">
            GMGN.BEST
            <small>REBATE 30%</small>
          </span>
        </a>

        <nav className="site-nav" aria-label="主导航">
          <a className="site-nav__link is-active" href="./index.html">
            <Database size={16} aria-hidden="true" />
            账本查询
          </a>
          <a className="site-nav__link" href="./referral.html">
            <Link2 size={16} aria-hidden="true" />
            返佣入口
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <button className="site-nav__link" type="button" onClick={onMethodology}>
            <BookOpenText size={16} aria-hidden="true" />
            数据口径
          </button>
        </nav>

        <div className="header-status" aria-label="账本状态">
          <span className="header-status__dot" />
          <span>
            自动同步
            <small>{generatedAt ? `更新于 ${formatDateTime(generatedAt)}` : '正在读取快照'}</small>
          </span>
        </div>
      </div>
    </header>
  )
}
