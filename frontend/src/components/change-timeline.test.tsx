import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChangeTimeline } from '@/components/change-timeline'
import type { ChangeEvent } from '@/lib/types'

// The "what changed" timeline (plan §7 Q5): consequential config/system changes
// as tick-marks across the current window, with a scannable list beneath that
// doubles as the keyboard/assistive-tech equivalent. Correlation, not causation
// — it aligns ticks to the same domain as the traffic curve, it never draws a
// causal link. As with the charts, we assert on aria + the list + the drill
// callback, and on positioning via inline style (jsdom gives us no layout).

const ev = (ms: number, over: Partial<ChangeEvent>): ChangeEvent => ({
  id: over.id ?? String(ms),
  ts: new Date(ms).toISOString(),
  kind: 'route',
  title: 'A change',
  detail: 'Some detail',
  source: 'git',
  ...over,
})

const EVENTS: ChangeEvent[] = [
  ev(25_000, { id: 'e1', kind: 'route', title: 'Failover engaged', source: 'system' }),
  ev(75_000, { id: 'e2', kind: 'budget', title: 'Budget lowered', detail: 'Cap set to $0.20', source: 'console' }),
  ev(200_000, { id: 'e3', kind: 'rule', title: 'Old rule promoted' }), // outside window
]

const WINDOW = { from: 0, to: 100_000 }
const time = () => '2:14pm' // deterministic clock for assertions

function renderTimeline(props: Partial<React.ComponentProps<typeof ChangeTimeline>> = {}) {
  return render(
    <ChangeTimeline
      changes={EVENTS}
      from={WINDOW.from}
      to={WINDOW.to}
      formatTime={time}
      {...props}
    />,
  )
}

describe('ChangeTimeline', () => {
  it('exposes an accessible group name', () => {
    renderTimeline()
    expect(screen.getByRole('group', { name: /what changed/i })).toBeInTheDocument()
  })

  it('sets data-slot for stable styling/test hooks', () => {
    const { container } = renderTimeline()
    expect(container.querySelector('[data-slot="change-timeline"]')).toBeInTheDocument()
  })

  it('renders one tick per in-window event and drops those outside the window', () => {
    const { container } = renderTimeline()
    const ticks = container.querySelectorAll('[data-slot="change-tick"]')
    expect(ticks).toHaveLength(2) // e3 is outside [0, 100_000]
  })

  it('positions each tick by its fraction across the window', () => {
    const { container } = renderTimeline()
    const byId = (id: string) =>
      container.querySelector<HTMLElement>(`[data-slot="change-tick"][data-id="${id}"]`)
    expect(byId('e1')?.style.left).toBe('25%')
    expect(byId('e2')?.style.left).toBe('75%')
  })

  it('labels each tick with its kind, title, and time — never a glyph alone', () => {
    renderTimeline()
    // aria-label carries the kind word so the tick is legible without color/glyph.
    expect(
      screen.getByRole('button', { name: /budget.*budget lowered.*2:14pm/i }),
    ).toBeInTheDocument()
  })

  it('lists each in-window change with its detail and provenance', () => {
    renderTimeline()
    const list = screen.getByRole('list', { name: /what changed/i })
    // Newest first, matching the rest of the console.
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Budget lowered')).toBeInTheDocument()
    expect(within(items[0]).getByText(/cap set to \$0\.20/i)).toBeInTheDocument()
    expect(within(items[0]).getByText('Console')).toBeInTheDocument() // source chip
  })

  it('drills when a tick is activated', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderTimeline({ onSelect })
    await user.click(screen.getByRole('button', { name: /budget.*budget lowered/i }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }))
  })

  it('drills when a list row is activated', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderTimeline({ onSelect })
    const list = screen.getByRole('list', { name: /what changed/i })
    await user.click(within(list).getByRole('button', { name: /failover engaged/i }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }))
  })

  it('renders a calm empty state when nothing changed in the range', () => {
    renderTimeline({ from: 300_000, to: 400_000 })
    expect(screen.getByText(/no changes in this range/i)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="change-tick"]')).toHaveLength(0)
  })
})
