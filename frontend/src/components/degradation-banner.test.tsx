import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DegradationBanner } from './degradation-banner'
import type { Degradation } from '@/lib/types'

const NOW = new Date('2026-09-18T12:00:00Z').getTime()

const make = (id: string, over: Partial<Degradation> = {}): Degradation => ({
  id,
  kind: 'failover',
  severity: 'warning',
  title: id,
  detail: `detail for ${id}`,
  dismissible: true,
  ...over,
})

function renderBanner(list: Degradation[], onDismiss?: (id: string) => void) {
  return render(
    <MemoryRouter>
      <DegradationBanner degradations={list} now={NOW} onDismiss={onDismiss} />
    </MemoryRouter>,
  )
}

describe('DegradationBanner', () => {
  it('renders nothing when nothing is degraded', () => {
    const { container } = renderBanner([])
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the lead degradation in the one banner slot', () => {
    renderBanner([make('Failover to backup')])
    expect(screen.getByText('Failover to backup')).toBeInTheDocument()
    expect(
      screen.getByText('detail for Failover to backup'),
    ).toBeInTheDocument()
  })

  it('collapses the rest behind a count and expands them in place', async () => {
    renderBanner([make('lead'), make('second'), make('third')])
    // Only the lead shows until expanded.
    expect(screen.queryByText('second')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+2 more' }))
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(screen.getByText('third')).toBeInTheDocument()
  })

  it('announces a fail-open assertively and never offers to dismiss it', () => {
    renderBanner(
      [make('Guardrails open', { kind: 'fail-open', severity: 'critical', dismissible: true })],
      vi.fn(),
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /dismiss/i }),
    ).not.toBeInTheDocument()
  })

  it('uses a polite status role for non-critical degradations', () => {
    renderBanner([make('Cache stale', { kind: 'cache-stale', severity: 'info' })])
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismisses a dismissible degradation', async () => {
    const onDismiss = vi.fn()
    renderBanner([make('Failover', { id: 'deg-1' })], onDismiss)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledWith('deg-1')
  })

  it('links to the surface that explains the degradation', () => {
    renderBanner([make('Failover', { href: '/traffic?verdict=rerouted' })])
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/traffic?verdict=rerouted',
    )
  })
})
