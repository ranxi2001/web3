import { ArrowLeft, Database, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react'

const chains = [
  ['BSC', 'BNB'],
  ['SOL', 'SOL'],
  ['ETH', 'ETH'],
  ['BASE', 'ETH_BASE'],
  ['Robinhood', 'ETH_ROB'],
]

export function ClaimPage() {
  return (
    <div className="claim-shell">
      <header className="claim-topbar">
        <a href="./" className="claim-brand"><img src="./gmgn-frog-coin.webp" alt="" />GMGN.BEST</a>
        <span><i />自动同步运行中</span>
      </header>
      <main className="claim-page">
        <a className="claim-back" href="./"><ArrowLeft size={16} />返回返佣账本</a>
        <section className="claim-hero">
          <div>
            <p>SELF-SERVICE CLAIM</p>
            <h1>领取全链返佣</h1>
            <span>系统自动同步 GMGN 分链交易数据。核对金额与白名单地址后，可主动发起领取。</span>
          </div>
          <div className="claim-sync"><RefreshCw size={17} /><span>数据状态<strong>自动同步</strong></span></div>
        </section>
        <section className="claim-panel">
          <div className="claim-panel__head">
            <div><Database size={20} /><span><strong>全链返佣明细</strong><small>登录账户后显示实时可领取金额</small></span></div>
            <b>返佣比例 30%</b>
          </div>
          <div className="claim-chains">
            {chains.map(([network, asset]) => (
              <article key={network}>
                <span>{network.slice(0, 2).toUpperCase()}</span>
                <div><strong>{network}</strong><small>{asset}</small></div>
                <p>登录后同步</p>
              </article>
            ))}
          </div>
          <div className="claim-total">
            <span>本次可领取</span>
            <strong>登录后计算</strong>
            <small>领取时按最新汇率折算</small>
          </div>
          <div className="claim-whitelist">
            <ShieldCheck size={21} />
            <div><strong>仅向白名单地址支付</strong><p>收款地址必须由当前账户主动绑定；修改地址需经过安全审核。</p></div>
          </div>
          <button type="button" disabled><WalletCards size={18} />登录后领取全链返佣</button>
          <p className="claim-security">GMGN.BEST 不会索要钱包私钥或助记词</p>
        </section>
      </main>
    </div>
  )
}