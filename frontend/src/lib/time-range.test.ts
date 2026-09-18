import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRESET,
  PRESETS,
  isLive,
  parseTimeRange,
  presetById,
  resolveWindow,
  serializeTimeRange,
} from './time-range'

const params = (init: Record<string, string>) => new URLSearchParams(init)

describe('PRESETS', () => {
  it('are short-biased, ordered, and strictly increasing in span', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['1h', '6h', '24h', '7d', '30d'])
    for (let i = 1; i < PRESETS.length; i++) {
      expect(PRESETS[i].ms).toBeGreaterThan(PRESETS[i - 1].ms)
    }
  })

  it('has a default that exists in the preset list', () => {
    expect(presetById(DEFAULT_PRESET)).toBeDefined()
  })
})

describe('parseTimeRange', () => {
  it('defaults to the default relative preset when nothing is in the URL', () => {
    expect(parseTimeRange(params({}))).toEqual({
      kind: 'relative',
      preset: DEFAULT_PRESET,
    })
  })

  it('reads a valid preset from ?range', () => {
    expect(parseTimeRange(params({ range: '24h' }))).toEqual({
      kind: 'relative',
      preset: '24h',
    })
  })

  it('falls back to default for an unknown ?range preset', () => {
    expect(parseTimeRange(params({ range: 'bogus' }))).toEqual({
      kind: 'relative',
      preset: DEFAULT_PRESET,
    })
  })

  it('reads an absolute window from valid ISO ?from/?to', () => {
    const from = '2026-09-18T00:00:00.000Z'
    const to = '2026-09-18T06:00:00.000Z'
    expect(parseTimeRange(params({ from, to }))).toEqual({
      kind: 'absolute',
      from: Date.parse(from),
      to: Date.parse(to),
    })
  })

  it('lets an absolute window win over a relative preset (a shared pinned link)', () => {
    const from = '2026-09-18T00:00:00.000Z'
    const to = '2026-09-18T06:00:00.000Z'
    const sel = parseTimeRange(params({ range: '1h', from, to }))
    expect(sel.kind).toBe('absolute')
  })

  it('falls back to default when from/to are unparseable', () => {
    expect(parseTimeRange(params({ from: 'nope', to: 'also-nope' }))).toEqual({
      kind: 'relative',
      preset: DEFAULT_PRESET,
    })
  })

  it('falls back to default when from is not strictly before to', () => {
    const t = '2026-09-18T06:00:00.000Z'
    expect(parseTimeRange(params({ from: t, to: t })).kind).toBe('relative')
    expect(
      parseTimeRange(
        params({ from: '2026-09-18T06:00:00.000Z', to: '2026-09-18T00:00:00.000Z' }),
      ).kind,
    ).toBe('relative')
  })
})

describe('serializeTimeRange', () => {
  it('writes ?range and clears any pinned window for a relative selection', () => {
    const base = params({ from: 'x', to: 'y', receipt: 'rcpt_1' })
    const next = serializeTimeRange({ kind: 'relative', preset: '6h' }, base)
    expect(next.get('range')).toBe('6h')
    expect(next.has('from')).toBe(false)
    expect(next.has('to')).toBe(false)
  })

  it('writes ISO ?from/?to and clears ?range for an absolute selection', () => {
    const from = Date.parse('2026-09-18T00:00:00.000Z')
    const to = Date.parse('2026-09-18T06:00:00.000Z')
    const next = serializeTimeRange({ kind: 'absolute', from, to }, params({ range: '1h' }))
    expect(next.has('range')).toBe(false)
    expect(next.get('from')).toBe('2026-09-18T00:00:00.000Z')
    expect(next.get('to')).toBe('2026-09-18T06:00:00.000Z')
  })

  it('preserves unrelated params (e.g. an open receipt or verdict filter)', () => {
    const base = params({ receipt: 'rcpt_1', verdict: 'blocked' })
    const next = serializeTimeRange({ kind: 'relative', preset: '7d' }, base)
    expect(next.get('receipt')).toBe('rcpt_1')
    expect(next.get('verdict')).toBe('blocked')
  })

  it('round-trips through parse for both selection kinds', () => {
    const rel = { kind: 'relative', preset: '30d' } as const
    expect(parseTimeRange(serializeTimeRange(rel, params({})))).toEqual(rel)

    const abs = {
      kind: 'absolute',
      from: Date.parse('2026-09-18T00:00:00.000Z'),
      to: Date.parse('2026-09-18T06:00:00.000Z'),
    } as const
    expect(parseTimeRange(serializeTimeRange(abs, params({})))).toEqual(abs)
  })
})

describe('resolveWindow', () => {
  const now = Date.parse('2026-09-18T12:00:00.000Z')

  it('anchors a relative window to end at now and span the preset', () => {
    const w = resolveWindow({ kind: 'relative', preset: '1h' }, now)
    expect(w.to).toBe(now)
    expect(w.from).toBe(now - 3_600_000)
  })

  it('slides a relative window forward as now advances (this is the live win)', () => {
    const sel = { kind: 'relative', preset: '24h' } as const
    const later = now + 5 * 60_000
    const a = resolveWindow(sel, now)
    const b = resolveWindow(sel, later)
    expect(b.from).toBe(a.from + 5 * 60_000)
    expect(b.to).toBe(a.to + 5 * 60_000)
  })

  it('returns a pinned absolute window unchanged regardless of now', () => {
    const sel = {
      kind: 'absolute',
      from: Date.parse('2026-09-18T00:00:00.000Z'),
      to: Date.parse('2026-09-18T06:00:00.000Z'),
    } as const
    expect(resolveWindow(sel, now)).toEqual({ from: sel.from, to: sel.to })
    expect(resolveWindow(sel, now + 9_999_999)).toEqual({ from: sel.from, to: sel.to })
  })
})

describe('isLive', () => {
  it('is true for a relative selection (auto-refreshing) and false when pinned', () => {
    expect(isLive({ kind: 'relative', preset: '1h' })).toBe(true)
    expect(isLive({ kind: 'absolute', from: 0, to: 1 })).toBe(false)
  })
})
