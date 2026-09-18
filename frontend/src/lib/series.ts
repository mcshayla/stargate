import type { BarSeriesDatum } from '@/components/ui/bar-series'
import type { SparklinePoint } from '@/components/ui/sparkline'
import type { StackedAreaDatum } from '@/components/ui/stacked-area'
import { VERDICTS } from '@/components/verdict-badge'
import type { ResolvedWindow } from '@/lib/time-range'
import type { ChangeEvent, Receipt, SpendRow } from '@/lib/types'

/**
 * Scope the stream to a resolved time window (epoch ms, inclusive both ends).
 * The single seam every Observe surface passes its receipts through so the
 * shared time-range control actually narrows what's on screen.
 */
export function windowReceipts(
  receipts: readonly Receipt[],
  window: ResolvedWindow,
): Receipt[] {
  return receipts.filter((r) => {
    const t = new Date(r.ts).getTime()
    return t >= window.from && t <= window.to
  })
}

// Pure selectors that turn the receipt stream into the shapes the chart
// primitives consume. Kept free of formatting and color: `x` stays epoch ms so
// these are deterministic and locale-independent; the page formats x for
// display and attaches verdict colors (from verdict-badge, the one source of
// truth) when building the StackedArea series.

/**
 * Assign each receipt to one of `bucketCount` equal-width time buckets spanning
 * [oldest, newest], and hand each bucket (with its start epoch ms) to `reduce`.
 * The newest receipt clamps into the last bucket rather than spilling past it.
 */
function bucketize<T>(
  receipts: Receipt[],
  bucketCount: number,
  reduce: (rows: Receipt[], startMs: number) => T,
): T[] {
  if (receipts.length === 0) return []

  const times = receipts.map((r) => new Date(r.ts).getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)
  const width = (max - min) / bucketCount || 1

  const buckets: Receipt[][] = Array.from({ length: bucketCount }, () => [])
  receipts.forEach((r, i) => {
    const idx = Math.min(bucketCount - 1, Math.floor((times[i] - min) / width))
    buckets[idx].push(r)
  })

  return buckets.map((rows, i) => reduce(rows, min + i * width))
}

/** Request volume over time — one point per bucket, y = request count. */
export function toVolumeSeries(
  receipts: Receipt[],
  bucketCount: number,
): SparklinePoint[] {
  return bucketize(receipts, bucketCount, (rows, startMs) => ({
    x: startMs,
    y: rows.length,
  }))
}

/** Spend over time — one point per bucket, y = summed cost (USD). */
export function toCostSeries(
  receipts: Receipt[],
  bucketCount: number,
): SparklinePoint[] {
  return bucketize(receipts, bucketCount, (rows, startMs) => ({
    x: startMs,
    y: rows.reduce((sum, r) => sum + r.costUsd, 0),
  }))
}

/** Verdict composition over time — each bucket carries a count per verdict. */
export function toVerdictSeries(
  receipts: Receipt[],
  bucketCount: number,
): StackedAreaDatum[] {
  return bucketize(receipts, bucketCount, (rows, startMs) => {
    const datum: StackedAreaDatum = { x: startMs }
    for (const v of VERDICTS) datum[v] = 0
    for (const r of rows) datum[r.verdict] = (datum[r.verdict] as number) + 1
    return datum
  })
}

/** Spend rows → labelled bars, preserving the rows' (already sorted) order. */
export function toSpendBars(rows: readonly SpendRow[]): BarSeriesDatum[] {
  return rows.map((row) => ({ label: row.scope, value: row.costUsd }))
}

/** A change event with its horizontal position on the "what changed" rail. */
export type PositionedChange = {
  event: ChangeEvent
  /** Fraction 0..1 of the event's timestamp across [from, to]. */
  pct: number
}

/**
 * Scope the change feed to the same window as the receipts and place each event
 * along the rail — the shared [from, to] domain is what lets a tick sit under
 * the traffic curve it correlates with. Newest first, so the list beneath the
 * rail reads top-down like the rest of the console.
 */
export function changesInWindow(
  changes: readonly ChangeEvent[],
  window: ResolvedWindow,
): PositionedChange[] {
  const span = window.to - window.from
  return changes
    .filter((e) => {
      const t = new Date(e.ts).getTime()
      return t >= window.from && t <= window.to
    })
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .map((event) => {
      const t = new Date(event.ts).getTime()
      const pct = span <= 0 ? 0 : Math.min(1, Math.max(0, (t - window.from) / span))
      return { event, pct }
    })
}
