import { spawnSync } from 'node:child_process'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { chainIdSchema, publicLedgerSchema } from '../src/lib/schema'

const syncConfigSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  clients: z.array(
    z.object({
      publicId: z.string().min(1),
      wallets: z.array(
        z.object({
          chain: chainIdSchema,
          address: z.string().min(1),
        }),
      ),
    }),
  ),
})

type UnknownRecord = Record<string, unknown>

const cliExecutable = process.platform === 'win32' ? 'gmgn-cli.cmd' : 'gmgn-cli'

const runCli = (args: string[]) => {
  const result = spawnSync(cliExecutable, args, {
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
  })

  if (result.error) {
    throw new Error(
      `Unable to run gmgn-cli. Install the pinned CLI first: npm install -g gmgn-cli@1.5.6\n${result.error.message}`,
    )
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'gmgn-cli failed')
  }
  return result.stdout.trim()
}

const parseCliJson = (output: string): UnknownRecord => {
  const lines = output.split(/\r?\n/).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines.slice(index).join('\n'))
      if (parsed && typeof parsed === 'object') return parsed as UnknownRecord
    } catch {
      // The CLI may print a status line before the raw JSON payload.
    }
  }
  throw new Error('gmgn-cli did not return a JSON object')
}

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' ? (value as UnknownRecord) : null

const activityList = (payload: UnknownRecord) => {
  const nested = asRecord(payload.data)
  const value = payload.activities ?? nested?.activities
  return Array.isArray(value) ? value.map(asRecord).filter(Boolean) as UnknownRecord[] : []
}

const nextCursor = (payload: UnknownRecord) => {
  const nested = asRecord(payload.data)
  const value = payload.next ?? nested?.next
  return typeof value === 'string' && value ? value : null
}

const toMilliseconds = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
}

const valueInMicros = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return 0n
  return BigInt(Math.round(numeric * 1_000_000))
}

const fetchWalletActivity = (
  chain: z.infer<typeof chainIdSchema>,
  address: string,
  periodStart: number,
  periodEnd: number,
) => {
  let cursor: string | null = null
  let page = 0
  let volumeMicros = 0n
  const transactions = new Set<string>()
  const events = new Set<string>()

  do {
    page += 1
    if (page > 200) throw new Error(`Pagination exceeded 200 pages for ${chain}`)

    const args = [
      'portfolio',
      'activity',
      '--chain',
      chain,
      '--wallet',
      address,
      '--type',
      'buy',
      '--type',
      'sell',
      '--limit',
      '50',
      '--raw',
    ]
    if (cursor) args.push('--cursor', cursor)

    const payload = parseCliJson(runCli(args))
    for (const activity of activityList(payload)) {
      const timestamp = toMilliseconds(activity.timestamp)
      if (timestamp === null || timestamp < periodStart || timestamp > periodEnd) continue

      const eventType = String(activity.event_type ?? activity.type ?? '')
      if (eventType !== 'buy' && eventType !== 'sell') continue

      const txHash = String(activity.tx_hash ?? activity.transaction_hash ?? '')
      if (!txHash) continue
      const token = asRecord(activity.token)
      const tokenAddress = String(token?.address ?? activity.token_address ?? '')
      const eventKey = `${chain}:${txHash}:${eventType}:${tokenAddress}`
      if (events.has(eventKey)) continue

      events.add(eventKey)
      transactions.add(`${chain}:${txHash}`)
      volumeMicros += valueInMicros(activity.cost_usd)
    }
    cursor = nextCursor(payload)
  } while (cursor)

  return {
    volumeUsd: Number(volumeMicros) / 1_000_000,
    tradeCount: transactions.size,
    pages: page,
  }
}

const configText = process.env.GMGN_CLIENTS_JSON
  ? process.env.GMGN_CLIENTS_JSON
  : await readFile(
      resolve(process.env.GMGN_CLIENTS_FILE ?? 'data/private/clients.json'),
      'utf8',
    )
const config = syncConfigSchema.parse(JSON.parse(configText))
const periodStart = Date.parse(config.periodStart)
const periodEnd = Date.parse(config.periodEnd)

if (Number.isNaN(periodStart) || Number.isNaN(periodEnd) || periodStart >= periodEnd) {
  throw new Error('The sync period is invalid')
}

const configuredClients = new Set<string>()
const configuredWallets = new Set<string>()
for (const client of config.clients) {
  if (configuredClients.has(client.publicId)) {
    throw new Error(`Duplicate client config: ${client.publicId}`)
  }
  configuredClients.add(client.publicId)

  for (const wallet of client.wallets) {
    const normalizedAddress = wallet.address.startsWith('0x')
      ? wallet.address.toLowerCase()
      : wallet.address
    const key = `${wallet.chain}:${normalizedAddress}`
    if (configuredWallets.has(key)) {
      throw new Error(`Duplicate wallet config: ${client.publicId} ${wallet.chain}`)
    }
    configuredWallets.add(key)
  }
}

runCli(['config', '--check'])

const ledgerPath = resolve('public/data/ledger.json')
const ledger = publicLedgerSchema.parse(JSON.parse(await readFile(ledgerPath, 'utf8')))

const configuredChains = new Set(
  config.clients.flatMap((client) =>
    client.wallets.map((wallet) => `${client.publicId}:${wallet.chain}`),
  ),
)
for (const customer of ledger.customers) {
  for (const chain of customer.chains) {
    if (!configuredChains.has(`${customer.publicId}:${chain.chain}`)) {
      chain.observedVolumeUsd = null
      chain.observedTradeCount = null
      chain.source.observed = null
      if (chain.status !== 'manual_review') chain.status = 'delayed'
    }
  }
}

for (const clientConfig of config.clients) {
  const customer = ledger.customers.find(
    (item) => item.publicId === clientConfig.publicId,
  )
  if (!customer) throw new Error(`Unknown publicId: ${clientConfig.publicId}`)
  if (customer.periodStart !== config.periodStart || customer.periodEnd !== config.periodEnd) {
    throw new Error(`Period mismatch for ${clientConfig.publicId}; update the public ledger first`)
  }

  const initializedChains = new Set<string>()
  for (const wallet of clientConfig.wallets) {
    const chainLedger = customer.chains.find((item) => item.chain === wallet.chain)
    if (!chainLedger) {
      throw new Error(`Missing ${wallet.chain} ledger row for ${clientConfig.publicId}`)
    }
    const result = fetchWalletActivity(
      wallet.chain,
      wallet.address,
      periodStart,
      periodEnd,
    )
    if (!initializedChains.has(wallet.chain)) {
      chainLedger.observedVolumeUsd = 0
      chainLedger.observedTradeCount = 0
      initializedChains.add(wallet.chain)
    }
    chainLedger.observedVolumeUsd =
      (chainLedger.observedVolumeUsd ?? 0) + result.volumeUsd
    chainLedger.observedTradeCount =
      (chainLedger.observedTradeCount ?? 0) + result.tradeCount
    chainLedger.snapshotAt = new Date().toISOString()
    chainLedger.source.observed = 'gmgn_portfolio_activity'
    if (chainLedger.status !== 'manual_review') chainLedger.status = 'current'
    console.log(
      `${clientConfig.publicId} ${wallet.chain}: ${result.tradeCount} tx across ${result.pages} page(s)`,
    )
  }
}

ledger.generatedAt = new Date().toISOString()
ledger.ledgerRevision = `gmgn-sync-${ledger.generatedAt.replace(/[:.]/g, '-')}`
publicLedgerSchema.parse(ledger)

const temporaryPath = `${ledgerPath}.tmp`
await writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
await rename(temporaryPath, ledgerPath)
console.log(`Updated ${ledgerPath}`)
