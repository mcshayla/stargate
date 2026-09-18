import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sparkline } from '@/components/ui/sparkline'

// The Sparkline is the first nebari-design chart primitive (plan §8). Recharts
// renders SVG, which jsdom can't measure, so these tests assert on the pieces
// the spec actually pins down: the accessible label, the keyboard/table
// fallback (§7.7), and the drill-to-receipts callback (§7.1). The SVG geometry
// is left to visual review — we never assert on chart paths here.

const DATA = [
  { x: '10:00', y: 12 },
  { x: '10:01', y: 40 },
  { x: '10:02', y: 7 },
]

describe('Sparkline', () => {
  it('exposes an accessible name for the metric it charts', () => {
    render(<Sparkline data={DATA} label="Requests per minute" />)
    expect(screen.getByRole('img', { name: /requests per minute/i })).toBeInTheDocument()
  })

  it('sets data-slot for stable styling/test hooks', () => {
    const { container } = render(<Sparkline data={DATA} label="Requests per minute" />)
    expect(container.querySelector('[data-slot="sparkline"]')).toBeInTheDocument()
  })

  it('offers a keyboard-accessible table fallback with a row per datum', async () => {
    const user = userEvent.setup()
    render(
      <Sparkline
        data={DATA}
        label="Requests per minute"
        formatY={(v) => `${v} req`}
      />,
    )

    // The table is toggle-able and starts hidden; a control reveals it.
    const toggle = screen.getByRole('button', { name: /data table/i })
    await user.click(toggle)

    const table = screen.getByRole('table', { name: /requests per minute/i })
    // One row per datum (excluding the header row).
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(DATA.length + 1)

    // Values render through the supplied formatter.
    expect(within(table).getByText('40 req')).toBeInTheDocument()
    expect(within(table).getByText('10:01')).toBeInTheDocument()
  })

  it('drills to the underlying slice when a table row is activated', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Sparkline
        data={DATA}
        label="Requests per minute"
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /data table/i }))
    // Each row is activatable (the accessible drill path); the second point.
    await user.click(screen.getByRole('button', { name: /10:01/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(DATA[1], 1)
  })

  it('renders a calm empty state instead of a broken chart', () => {
    render(<Sparkline data={[]} label="Requests per minute" />)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
    // Nothing to drill into, so no table toggle.
    expect(screen.queryByRole('button', { name: /data table/i })).not.toBeInTheDocument()
  })
})
