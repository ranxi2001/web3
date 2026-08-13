import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ledgerJson from '../../public/data/ledger.json'
import referralsJson from '../../public/data/referrals.json'
import { ReferralPage } from './ReferralPage'

describe('referral page conversion flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the animated estimate immediately before registration entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input)
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue(
            url.includes('referrals.json') ? referralsJson : ledgerJson,
          ),
        })
      }),
    )
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true }),
    )

    render(<ReferralPage />)

    const estimateHeading = await screen.findByRole('heading', {
      name: 'GMGN 手续费，返你 30%',
    })
    const directoryHeading = screen.getByRole('heading', {
      name: '选择平台，立即注册',
    })

    expect(estimateHeading.closest('section')?.nextElementSibling).toBe(
      directoryHeading.closest('section'),
    )
    expect(screen.getByText('$25K')).toBeInTheDocument()
    expect(screen.getByText('$75')).toBeInTheDocument()
    expect(screen.queryByText('安全核对')).not.toBeInTheDocument()
    expect(screen.queryByText('来源与更新')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^前往 OKX，/ })).toHaveLength(2)
  })
})
