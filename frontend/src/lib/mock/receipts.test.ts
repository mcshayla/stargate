import { describe, expect, it } from 'vitest'
import { PRESETS, resolveWindow } from '@/lib/time-range'
import { windowReceipts } from '@/lib/series'
import type { Receipt } from '@/lib/types'
import {
  computeTotals,
  receipts,
  spendByTeam,
} from '@/lib/mock/receipts'

const DAY = 24 * 60 * 60 * 1000

describe('mock backlog', () => {
  it('is sorted newest-first', () => {
    const times = receipts.map((r) => new Date(r.ts).getTime())
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1])
    }
  })

  it('spans close to the widest (30d) preset so long windows have data', () => {
    const times = receipts.map((r) => new Date(r.ts).getTime())
    const spanMs = Math.max(...times) - Math.min(...times)
    expect(spanMs).toBeGreaterThan(25 * DAY)
  })

  it('reveals a strictly larger slice as the preset widens (the whole point)', () => {
    const now = Math.max(...receipts.map((r) => new Date(r.ts).getTime()))
    const counts = PRESETS.map(
      (p) =>
        windowReceipts(receipts, resolveWindow({ kind: 'relative', preset: p.id }, now))
          .length,
    )
    // Non-decreasing across presets...
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    }
    // ...and the shortest window genuinely shows less than the widest.
    expect(counts[0]).toBeLessThan(counts[counts.length - 1])
    // The widest preset covers the whole backlog.
    expect(counts[counts.length - 1]).toBe(receipts.length)
  })
})

const row = (over: Partial<Receipt>): Receipt =>
  ({
    verdict: 'allowed',
    costUsd: 0,
    durationMs: 0,
    team: 'platform',
    ...over,
  }) as Receipt

describe('computeTotals', () => {
  it('aggregates a slice and averages latency', () => {
    const rows = [
      row({ verdict: 'allowed', costUsd: 1, durationMs: 100 }),
      row({ verdict: 'blocked', costUsd: 0, durationMs: 300 }),
      row({ verdict: 'redacted', costUsd: 2, durationMs: 200 }),
    ]
    expect(computeTotals(rows)).toEqual({
      requests: 3,
      spendUsd: 3,
      blocked: 1,
      redacted: 1,
      avgLatencyMs: 200,
    })
  })

  it('does not divide by zero on an empty window', () => {
    expect(computeTotals([])).toMatchObject({ requests: 0, avgLatencyMs: 0 })
  })
})

describe('spendByTeam', () => {
  it('groups by team, sorts by cost desc, and attaches known budgets', () => {
    const rows = [
      row({ team: 'platform', costUsd: 1 }),
      row({ team: 'research', costUsd: 5 }),
      row({ team: 'research', costUsd: 5 }),
    ]
    const spend = spendByTeam(rows)
    expect(spend[0].scope).toBe('research')
    expect(spend[0].costUsd).toBe(10)
    expect(spend[0].enforcement).toBe('block')
    expect(spend.find((r) => r.scope === 'platform')?.budgetUsd).toBe(0.5)
  })
})
