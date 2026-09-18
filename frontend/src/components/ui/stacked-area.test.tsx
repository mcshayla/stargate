import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StackedArea } from '@/components/ui/stacked-area'

// Second nebari-design chart primitive (plan §8) — a stacked-area chart for a
// composition over time (the verdict breakdown is the canonical use, drawn with
// the Q6 ramp). As with Sparkline, we assert on the accessible table fallback,
// aria, and drill callback — never on the SVG, which jsdom can't render.

const SERIES = [
  { key: 'allowed', label: 'Allowed', color: 'var(--chart-1)' },
  { key: 'blocked', label: 'Blocked', color: 'var(--destructive)' },
]

const DATA = [
  { x: '10:00', allowed: 100, blocked: 2 },
  { x: '10:01', allowed: 140, blocked: 5 },
]

describe('StackedArea', () => {
  it('exposes an accessible name for the composition it charts', () => {
    render(<StackedArea data={DATA} series={SERIES} label="Verdicts over time" />)
    expect(screen.getByRole('img', { name: /verdicts over time/i })).toBeInTheDocument()
  })

  it('sets data-slot for stable styling/test hooks', () => {
    const { container } = render(
      <StackedArea data={DATA} series={SERIES} label="Verdicts over time" />,
    )
    expect(container.querySelector('[data-slot="stacked-area"]')).toBeInTheDocument()
  })

  it('offers a table fallback with a column per series and a row per datum', async () => {
    const user = userEvent.setup()
    render(
      <StackedArea
        data={DATA}
        series={SERIES}
        label="Verdicts over time"
        formatY={(v) => `${v} req`}
      />,
    )

    await user.click(screen.getByRole('button', { name: /data table/i }))
    const table = screen.getByRole('table', { name: /verdicts over time/i })

    // A header column per series, plus the leading "Point" column.
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual(['Point', 'Allowed', 'Blocked'])

    // One row per datum (plus the header row).
    expect(within(table).getAllByRole('row')).toHaveLength(DATA.length + 1)
    expect(within(table).getByText('140 req')).toBeInTheDocument()
    expect(within(table).getByText('5 req')).toBeInTheDocument()
  })

  it('drills to the underlying slice when a table row is activated', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <StackedArea
        data={DATA}
        series={SERIES}
        label="Verdicts over time"
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /data table/i }))
    await user.click(screen.getByRole('button', { name: /10:01/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(DATA[1], 1)
  })

  it('renders a calm empty state instead of a broken chart', () => {
    render(<StackedArea data={[]} series={SERIES} label="Verdicts over time" />)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /data table/i })).not.toBeInTheDocument()
  })

  it('labels every band in an always-visible legend (never color alone)', () => {
    render(<StackedArea data={DATA} series={SERIES} label="Verdicts over time" />)
    const legend = screen.getByRole('list', { name: /legend/i })
    expect(within(legend).getByText('Allowed')).toBeInTheDocument()
    expect(within(legend).getByText('Blocked')).toBeInTheDocument()
  })

  it('shows a color swatch per series alongside its label', () => {
    const { container } = render(
      <StackedArea data={DATA} series={SERIES} label="Verdicts over time" />,
    )
    expect(
      container.querySelectorAll(
        '[data-slot="stacked-area-legend"] [data-swatch]',
      ),
    ).toHaveLength(SERIES.length)
  })

  it('drills by series when a legend item is activated', async () => {
    const user = userEvent.setup()
    const onSelectSeries = vi.fn()
    render(
      <StackedArea
        data={DATA}
        series={SERIES}
        label="Verdicts over time"
        onSelectSeries={onSelectSeries}
      />,
    )
    await user.click(screen.getByRole('button', { name: /blocked/i }))
    expect(onSelectSeries).toHaveBeenCalledTimes(1)
    expect(onSelectSeries).toHaveBeenCalledWith('blocked')
  })

  it('renders legend items as static text when not interactive', () => {
    render(<StackedArea data={DATA} series={SERIES} label="Verdicts over time" />)
    expect(screen.queryByRole('button', { name: /allowed/i })).not.toBeInTheDocument()
  })
})
