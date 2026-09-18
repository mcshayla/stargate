import { describe, expect, it } from 'vitest'
import {
  changesInWindow,
  toCostSeries,
  toSpendBars,
  toVerdictSeries,
  toVolumeSeries,
  windowReceipts,
} from '@/lib/series'
import type { ChangeEvent, Receipt, SpendRow, Verdict } from '@/lib/types'

// The chart-data selectors turn the receipt stream into the shapes the chart
// primitives consume. They're pure and time-based, so we test them with
// hand-built receipts at explicit timestamps rather than the seeded mock —
// deterministic, and independent of locale-sensitive formatting (x stays epoch
// ms; the page formats it).

const at = (ms: number, verdict: Verdict, costUsd = 0): Receipt =>
  ({ ts: new Date(ms).toISOString(), verdict, costUsd }) as Receipt

// Two 35s-wide buckets across a 70s span.
const SPAN = [
  at(0, 'allowed'),
  at(10_000, 'blocked'),
  at(60_000, 'allowed'),
  at(70_000, 'redacted'), // max ts → clamps into the last bucket
]

describe('toVolumeSeries', () => {
  it('counts receipts into equal-width time buckets, oldest first', () => {
    expect(toVolumeSeries(SPAN, 2)).toEqual([
      { x: 0, y: 2 },
      { x: 35_000, y: 2 },
    ])
  })

  it('returns an empty series for no receipts', () => {
    expect(toVolumeSeries([], 2)).toEqual([])
  })
})

describe('toVerdictSeries', () => {
  it('splits each bucket into a count per verdict, zero-filling absent verdicts', () => {
    const series = toVerdictSeries(SPAN, 2)
    expect(series).toHaveLength(2)
    // Every datum carries every verdict key so the stack is stable over time.
    expect(series[0]).toMatchObject({ x: 0, allowed: 1, blocked: 1, redacted: 0 })
    expect(series[1]).toMatchObject({ x: 35_000, allowed: 1, redacted: 1, blocked: 0 })
  })
})

describe('toCostSeries', () => {
  it('sums cost into equal-width time buckets, oldest first', () => {
    const rows = [
      at(0, 'allowed', 1.5),
      at(10_000, 'allowed', 0.5),
      at(60_000, 'allowed', 2),
      at(70_000, 'allowed', 4),
    ]
    expect(toCostSeries(rows, 2)).toEqual([
      { x: 0, y: 2 },
      { x: 35_000, y: 6 },
    ])
  })
})

describe('windowReceipts', () => {
  it('keeps only receipts inside the window, inclusive of both ends', () => {
    const inside = windowReceipts(SPAN, { from: 10_000, to: 60_000 })
    expect(inside.map((r) => new Date(r.ts).getTime())).toEqual([10_000, 60_000])
  })

  it('returns nothing when the window predates the stream', () => {
    expect(windowReceipts(SPAN, { from: -20_000, to: -10_000 })).toEqual([])
  })

  it('returns everything for a window that spans the whole stream', () => {
    expect(windowReceipts(SPAN, { from: 0, to: 70_000 })).toHaveLength(SPAN.length)
  })
})

describe('changesInWindow', () => {
  const chg = (ms: number, id: string): ChangeEvent =>
    ({ id, ts: new Date(ms).toISOString(), kind: 'route' }) as ChangeEvent

  const EVENTS = [chg(0, 'a'), chg(25_000, 'b'), chg(75_000, 'c'), chg(100_000, 'd')]

  it('keeps only events inside the window, inclusive of both ends', () => {
    const kept = changesInWindow(EVENTS, { from: 25_000, to: 75_000 })
    expect(kept.map((c) => c.event.id)).toEqual(['c', 'b']) // newest first
  })

  it('positions each event as a 0..1 fraction across the window', () => {
    const kept = changesInWindow(EVENTS, { from: 0, to: 100_000 })
    const pct = Object.fromEntries(kept.map((c) => [c.event.id, c.pct]))
    expect(pct).toMatchObject({ a: 0, b: 0.25, c: 0.75, d: 1 })
  })

  it('clamps to [0,1] and never divides by zero for a zero-width window', () => {
    const kept = changesInWindow([chg(500, 'x')], { from: 500, to: 500 })
    expect(kept).toEqual([{ event: expect.objectContaining({ id: 'x' }), pct: 0 }])
  })

  it('returns nothing when the window misses every event', () => {
    expect(changesInWindow(EVENTS, { from: 200_000, to: 300_000 })).toEqual([])
  })
})

describe('toSpendBars', () => {
  it('maps spend rows to labelled bars', () => {
    const rows: SpendRow[] = [
      { scope: 'research', requests: 3, costUsd: 12.5 },
      { scope: 'platform', requests: 5, costUsd: 8 },
    ]
    expect(toSpendBars(rows)).toEqual([
      { label: 'research', value: 12.5 },
      { label: 'platform', value: 8 },
    ])
  })
})
