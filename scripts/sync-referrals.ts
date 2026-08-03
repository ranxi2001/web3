import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const SOURCE_URL = 'https://vlink.cc/tosky'
const OUTPUT_PATH = resolve(process.cwd(), 'public/data/referrals.json')
const OKX_CODE_ITEM_ID = 'pvoiWtAlph'

type Category = 'exchange' | 'web3' | 'card'
type DomainKind = 'official' | 'partner'

interface VlinkItem {
  id: string
  title: string
  link: string
  type: string
  icon: string
  show: boolean
}

interface NextData {
  buildId: string
  props: {
    pageProps: {
      userBaseInfo: {
        linkList: VlinkItem[]
      }
    }
  }
}

interface Selection {
  id: string
  sourceLinkId: string
  extraSourceItemIds?: string[]
  platform: string
  title: string
  category: Category
  expectedDomain: string
  domainKind: DomainKind
}

const SELECTIONS: Selection[] = [
  {
    id: 'okx-green-channel',
    sourceLinkId: 'uwDun_zxXo',
    extraSourceItemIds: [OKX_CODE_ITEM_ID],
    platform: 'OKX',
    title: 'OKX 注册绿色通道',
    category: 'exchange',
    expectedDomain: 'www.firgrouxywebb.com',
    domainKind: 'partner',
  },
  {
    id: 'okx-official',
    sourceLinkId: 'RpySBzzyYI',
    extraSourceItemIds: [OKX_CODE_ITEM_ID],
    platform: 'OKX',
    title: 'OKX 官网注册',
    category: 'exchange',
    expectedDomain: 'www.okx.com',
    domainKind: 'official',
  },
  {
    id: 'binance-exchange',
    sourceLinkId: 'MRjcucrZ3q',
    platform: 'Binance',
    title: '币安注册',
    category: 'exchange',
    expectedDomain: 'www.maxweb.red',
    domainKind: 'partner',
  },
  {
    id: 'bybit-exchange',
    sourceLinkId: 'UWbyjJf69E',
    platform: 'Bybit',
    title: 'Bybit 注册',
    category: 'exchange',
    expectedDomain: 'partner.bybit.com',
    domainKind: 'official',
  },
  {
    id: 'bitget-exchange',
    sourceLinkId: 'WyExf7j1eY',
    platform: 'Bitget',
    title: 'Bitget 注册',
    category: 'exchange',
    expectedDomain: 'partner.hdmune.cn',
    domainKind: 'partner',
  },
  {
    id: 'gate-exchange',
    sourceLinkId: 'vhF-_BlTjy',
    platform: 'Gate',
    title: 'Gate 芝麻开门注册',
    category: 'exchange',
    expectedDomain: 'www.gatesite.space',
    domainKind: 'partner',
  },
  {
    id: 'gmgn-web3',
    sourceLinkId: 'TvRxqrjxrd',
    platform: 'GMGN',
    title: 'GMGN 链上交易工具',
    category: 'web3',
    expectedDomain: 'gmgn.ai',
    domainKind: 'official',
  },
  {
    id: 'okx-web3-wallet',
    sourceLinkId: 'ZOSENShlRL',
    platform: 'OKX Web3',
    title: 'OKX Web3 钱包',
    category: 'web3',
    expectedDomain: 'web3.okx.com',
    domainKind: 'official',
  },
  {
    id: 'binance-wallet',
    sourceLinkId: 'N74mq5jOem',
    platform: 'Binance Wallet',
    title: '币安钱包',
    category: 'web3',
    expectedDomain: 'web3.binance.com',
    domainKind: 'official',
  },
  {
    id: 'bybit-card',
    sourceLinkId: 'pE0cVEVJ-Z',
    platform: 'Bybit Card',
    title: 'Bybit Card U 卡',
    category: 'card',
    expectedDomain: 'www.bybit.com',
    domainKind: 'official',
  },
]

function parseNextData(html: string): NextData {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/,
  )
  if (!match?.[1]) throw new Error('VLink page does not contain __NEXT_DATA__')

  const parsed = JSON.parse(match[1]) as NextData
  if (!Array.isArray(parsed.props?.pageProps?.userBaseInfo?.linkList)) {
    throw new Error('VLink linkList is missing or invalid')
  }
  return parsed
}

function deriveReferralCode(url: URL) {
  const queryCode = url.searchParams.get('ref')
  if (queryCode) return queryCode

  const segments = url.pathname.split('/').filter(Boolean)
  const code = segments.at(-1)
  if (!code) throw new Error(`Cannot derive referral code from ${url.toString()}`)
  return code
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': 'tosky-referral-directory-sync/1.0' },
  })
  if (!response.ok) throw new Error(`VLink request failed: HTTP ${response.status}`)

  const nextData = parseNextData(await response.text())
  const sourceItems = nextData.props.pageProps.userBaseInfo.linkList
  const byId = new Map(sourceItems.map((item) => [item.id, item]))

  const entries = SELECTIONS.map((selection) => {
    const item = byId.get(selection.sourceLinkId)
    if (!item || item.type !== 'link' || !item.show || !item.link) {
      throw new Error(`Required VLink item is missing or inactive: ${selection.sourceLinkId}`)
    }

    const target = new URL(item.link)
    if (target.hostname !== selection.expectedDomain) {
      throw new Error(
        `Domain changed for ${selection.id}: expected ${selection.expectedDomain}, received ${target.hostname}`,
      )
    }

    const relatedIds = [selection.sourceLinkId, ...(selection.extraSourceItemIds ?? [])]
    const relatedItems = relatedIds.map((id) => {
      const related = byId.get(id)
      if (!related) throw new Error(`Required source record is missing: ${id}`)
      return { id: related.id, title: related.title }
    })

    const referralCode = deriveReferralCode(target)
    if (selection.extraSourceItemIds?.includes(OKX_CODE_ITEM_ID)) {
      const sourceCode = byId.get(OKX_CODE_ITEM_ID)?.link
      if (sourceCode !== referralCode) {
        throw new Error(`OKX invite code mismatch: link=${referralCode}, copy item=${sourceCode}`)
      }
    }

    return {
      id: selection.id,
      platform: selection.platform,
      title: selection.title,
      category: selection.category,
      benefit: `来源页原文：${relatedItems
        .map((related) => related.title.replace(/\s+/g, ' ').trim())
        .join(' / ')}`,
      url: item.link,
      targetDomain: target.hostname,
      domainKind: selection.domainKind,
      referralCode,
      iconUrl: item.icon,
      sourceItems: relatedItems,
    }
  })

  const snapshot = {
    version: 1,
    source: {
      provider: 'VLink / tosky',
      page: SOURCE_URL,
      checkedAt: new Date().toISOString(),
      pageBuildId: nextData.buildId,
    },
    entries,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  console.log(`Synced ${entries.length} referral links to ${OUTPUT_PATH}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
