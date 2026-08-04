import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ledgerJson from '../public/data/ledger.json'
import App from './App'

describe('dashboard bootstrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the public ledger and renders the overview', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(ledgerJson),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByRole('heading', { name: '公开账本总览' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '共享收益如何计算' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/data\/ledger\.json$/),
      { cache: 'no-store' },
    )
  })
})
