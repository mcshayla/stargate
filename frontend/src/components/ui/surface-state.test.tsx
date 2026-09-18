import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SurfaceState } from './surface-state'

const CHILD = <p>live content</p>

describe('SurfaceState', () => {
  it('renders children in the ready state', () => {
    render(<SurfaceState state="ready">{CHILD}</SurfaceState>)
    expect(screen.getByText('live content')).toBeInTheDocument()
  })

  it('keeps children on screen in the stale state, beneath a marker', () => {
    render(
      <SurfaceState state="stale" staleLabel="Showing data from 2m ago">
        {CHILD}
      </SurfaceState>,
    )
    // Degraded is never blank: the data stays, the marker explains why.
    expect(screen.getByText('live content')).toBeInTheDocument()
    expect(screen.getByText('Showing data from 2m ago')).toBeInTheDocument()
  })

  it('fires onRefresh from the stale marker', async () => {
    const onRefresh = vi.fn()
    render(
      <SurfaceState state="stale" onRefresh={onRefresh}>
        {CHILD}
      </SurfaceState>,
    )
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('replaces children with a spinner while loading', () => {
    render(<SurfaceState state="loading">{CHILD}</SurfaceState>)
    expect(screen.queryByText('live content')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the empty state with title and action, not the children', () => {
    render(
      <SurfaceState
        state="empty"
        emptyTitle="No receipts yet"
        emptyAction={<button type="button">Load demo</button>}
      >
        {CHILD}
      </SurfaceState>,
    )
    expect(screen.queryByText('live content')).not.toBeInTheDocument()
    expect(screen.getByText('No receipts yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load demo' })).toBeInTheDocument()
  })

  it('announces the error state assertively and retries', async () => {
    const onRetry = vi.fn()
    render(
      <SurfaceState state="error" errorMessage="Gateway timed out" onRetry={onRetry}>
        {CHILD}
      </SurfaceState>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Gateway timed out')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('names the required role and contact in the denied state', () => {
    render(
      <SurfaceState state="denied" deniedRole="admin" deniedContact="your platform team">
        {CHILD}
      </SurfaceState>,
    )
    expect(screen.queryByText('live content')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('admin')
    expect(screen.getByRole('status')).toHaveTextContent('your platform team')
  })

  it('derives the state from flags when no explicit state is given', () => {
    // stale + isEmpty must resolve to stale (never degraded-as-empty).
    render(
      <SurfaceState stale isEmpty staleLabel="Feed degraded">
        {CHILD}
      </SurfaceState>,
    )
    expect(screen.getByText('live content')).toBeInTheDocument()
    expect(screen.getByText('Feed degraded')).toBeInTheDocument()
  })
})
