import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BarSeries } from '@/components/ui/bar-series'

// Third nebari-design chart primitive (plan §8) — a categorical bar chart for a
// breakdown (spend by team/model/provider is the canonical use). Same contract
// as the other primitives: assert on the accessible table fallback, aria, and
// the drill callback; never on the SVG, which jsdom can't render.

const DATA = [
  { label: 'research', value: 1240.5 },
  { label: 'platform', value: 830 },
]

describe('BarSeries', () => {
  it('exposes an accessible name for the breakdown it charts', () => {
    render(<BarSeries data={DATA} label="Spend by team" />)
    expect(screen.getByRole('img', { name: /spend by team/i })).toBeInTheDocument()
  })

  it('sets data-slot for stable styling/test hooks', () => {
    const { container } = render(<BarSeries data={DATA} label="Spend by team" />)
    expect(container.querySelector('[data-slot="bar-series"]')).toBeInTheDocument()
  })

  it('offers a table fallback with a category + value column and a row per bar', async () => {
    const user = userEvent.setup()
    render(
      <BarSeries
        data={DATA}
        label="Spend by team"
        formatValue={(v) => `$${v.toFixed(2)}`}
      />,
    )

    await user.click(screen.getByRole('button', { name: /data table/i }))
    const table = screen.getByRole('table', { name: /spend by team/i })

    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual(['Category', 'Value'])

    expect(within(table).getAllByRole('row')).toHaveLength(DATA.length + 1)
    expect(within(table).getByText('$1240.50')).toBeInTheDocument()
    expect(within(table).getByText('$830.00')).toBeInTheDocument()
  })

  it('drills to the underlying slice when a table row is activated', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<BarSeries data={DATA} label="Spend by team" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /data table/i }))
    await user.click(screen.getByRole('button', { name: /research/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(DATA[0], 0)
  })

  it('renders a calm empty state instead of a broken chart', () => {
    render(<BarSeries data={[]} label="Spend by team" />)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /data table/i })).not.toBeInTheDocument()
  })
})
