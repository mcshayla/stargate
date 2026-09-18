import { describe, expect, it } from 'vitest'
import {
  canDismissDegradation,
  rankDegradations,
  worstSeverity,
} from './degradation'
import type { Degradation } from '@/lib/types'

const make = (
  id: string,
  over: Partial<Degradation> = {},
): Degradation => ({
  id,
  kind: 'cache-stale',
  severity: 'info',
  title: id,
  detail: '',
  dismissible: true,
  ...over,
})

describe('rankDegradations', () => {
  it('orders by severity, worst first', () => {
    const ranked = rankDegradations([
      make('a', { severity: 'info' }),
      make('b', { severity: 'critical' }),
      make('c', { severity: 'warning' }),
    ])
    expect(ranked.map((d) => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks severity ties in favor of fail-open (a security event)', () => {
    const ranked = rankDegradations([
      make('cp', { severity: 'critical', kind: 'control-plane' }),
      make('fo', { severity: 'critical', kind: 'fail-open' }),
    ])
    expect(ranked[0].id).toBe('fo')
  })

  it('leads with the longest-running issue among full equals', () => {
    const ranked = rankDegradations([
      make('newer', { since: '2026-09-18T10:00:00Z' }),
      make('older', { since: '2026-09-18T08:00:00Z' }),
    ])
    expect(ranked.map((d) => d.id)).toEqual(['older', 'newer'])
  })

  it('does not mutate its input', () => {
    const input = [make('a', { severity: 'info' }), make('b', { severity: 'critical' })]
    rankDegradations(input)
    expect(input.map((d) => d.id)).toEqual(['a', 'b'])
  })
})

describe('worstSeverity', () => {
  it('is null when nothing is degraded', () => {
    expect(worstSeverity([])).toBeNull()
  })

  it('reports the loudest active severity', () => {
    expect(
      worstSeverity([
        make('a', { severity: 'info' }),
        make('b', { severity: 'warning' }),
      ]),
    ).toBe('warning')
  })
})

describe('canDismissDegradation', () => {
  it('never lets a fail-open be dismissed, even if flagged dismissible', () => {
    expect(
      canDismissDegradation(make('fo', { kind: 'fail-open', dismissible: true })),
    ).toBe(false)
  })

  it('honors the flag for every other kind', () => {
    expect(canDismissDegradation(make('a', { dismissible: true }))).toBe(true)
    expect(canDismissDegradation(make('b', { dismissible: false }))).toBe(false)
  })
})
