import { hashWalletAddress, looksLikeWalletAddress } from '../src/lib/ledger'

const address = process.argv[2]?.trim()

if (!address || !looksLikeWalletAddress(address)) {
  console.error('Usage: npm run wallet:hash -- <EVM or Solana wallet address>')
  process.exit(1)
}

console.log(await hashWalletAddress(address))
