import { MemoryRouter, useLocation } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TimeRange } from './time-range'

// A location probe rendered beside the control lets us assert what the control
// writes to the URL — the canonical store the Observe surfaces read from.
function LocationProbe() {
  const { search } = useLocation()
  return <output data-testid="search">{search}</output>
}

function setup(initialEntries: string[] = ['/']) {
  const ui = (
    <MemoryRouter initialEntries={initialEntries}>
      <TimeRange />
      <LocationProbe />
    </MemoryRouter>
  )
  return { user: userEvent.setup(), ...render(ui) }
}

const search = () => screen.getByTestId('search').textContent ?? ''
const preset = (label: string) => screen.getByRole('button', { name: label })

describe('TimeRange', () => {
  it('marks the URL-selected preset as pressed (not a hardcoded default)', () => {
    setup(['/?range=24h'])
    expect(preset('24h')).toHaveAttribute('aria-pressed', 'true')
    expect(preset('1h')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a live indicator while a relative preset is active', () => {
    setup(['/?range=6h'])
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('writes ?range and moves the pressed state when a preset is clicked', async () => {
    const { user } = setup(['/?range=1h'])
    await user.click(preset('7d'))
    expect(search()).toContain('range=7d')
    expect(preset('7d')).toHaveAttribute('aria-pressed', 'true')
    expect(preset('1h')).toHaveAttribute('aria-pressed', 'false')
  })

  it('pins an absolute window from the custom picker and drops to non-live', async () => {
    const { user } = setup(['/?range=1h'])
    await user.click(screen.getByRole('button', { name: 'Custom' }))
    const dialog = screen.getByRole('dialog', { name: 'Custom time range' })
    expect(dialog).toBeInTheDocument()

    const from = within(dialog).getByLabelText('From')
    const to = within(dialog).getByLabelText('To')
    await user.clear(from)
    await user.type(from, '2026-09-18T00:00')
    await user.clear(to)
    await user.type(to, '2026-09-18T06:00')
    await user.click(within(dialog).getByRole('button', { name: 'Apply range' }))

    expect(search()).toContain('from=')
    expect(search()).toContain('to=')
    expect(search()).not.toContain('range=')
    expect(screen.getByText(/Pinned/)).toBeInTheDocument()
    // No preset is pressed while pinned; Custom is.
    expect(preset('1h')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('returns to the last live preset via "Go live" when pinned', async () => {
    const { user } = setup([
      '/?from=2026-09-18T00:00:00.000Z&to=2026-09-18T06:00:00.000Z',
    ])
    expect(screen.getByText(/Pinned/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Go live/ }))
    // Defaults to 1h when there was no prior live preset this session.
    expect(search()).toContain('range=1h')
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})
