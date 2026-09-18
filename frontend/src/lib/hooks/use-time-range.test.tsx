import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimeRange } from './use-time-range'

// Render the hook alongside a location probe so we can assert what lands in the
// URL — the canonical store — not just the returned object.
function harness(initialEntries: string[] = ['/']) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  )
  return renderHook(
    () => ({ range: useTimeRange(), location: useLocation() }),
    { wrapper },
  )
}

const search = (r: ReturnType<typeof harness>) =>
  new URLSearchParams(r.result.current.location.search)

describe('useTimeRange', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('defaults to a live 1h window ending at now', () => {
    vi.setSystemTime(Date.parse('2026-09-18T12:00:00.000Z'))
    const r = harness()
    expect(r.result.current.range.selection).toEqual({
      kind: 'relative',
      preset: '1h',
    })
    expect(r.result.current.range.live).toBe(true)
    expect(r.result.current.range.to).toBe(Date.parse('2026-09-18T12:00:00.000Z'))
    expect(r.result.current.range.from).toBe(Date.parse('2026-09-18T11:00:00.000Z'))
  })

  it('setPreset writes ?range to the URL and updates the selection', () => {
    const r = harness()
    act(() => r.result.current.range.setPreset('24h'))
    expect(search(r).get('range')).toBe('24h')
    expect(r.result.current.range.selection).toEqual({
      kind: 'relative',
      preset: '24h',
    })
  })

  it('pin writes ISO ?from/?to, clears ?range, and stops being live', () => {
    const r = harness(['/?range=1h'])
    const from = Date.parse('2026-09-18T00:00:00.000Z')
    const to = Date.parse('2026-09-18T06:00:00.000Z')
    act(() => r.result.current.range.pin(from, to))
    const p = search(r)
    expect(p.has('range')).toBe(false)
    expect(p.get('from')).toBe('2026-09-18T00:00:00.000Z')
    expect(p.get('to')).toBe('2026-09-18T06:00:00.000Z')
    expect(r.result.current.range.live).toBe(false)
    expect(r.result.current.range.from).toBe(from)
    expect(r.result.current.range.to).toBe(to)
  })

  it('slides the window forward as time passes while live', () => {
    vi.setSystemTime(Date.parse('2026-09-18T12:00:00.000Z'))
    const r = harness()
    const before = r.result.current.range.to
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(r.result.current.range.to).toBe(before + 30_000)
    expect(r.result.current.range.from).toBe(before + 30_000 - 3_600_000)
  })

  it('freezes the window once pinned — ticks no longer move it', () => {
    const from = Date.parse('2026-09-18T00:00:00.000Z')
    const to = Date.parse('2026-09-18T06:00:00.000Z')
    const r = harness([`/?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`])
    expect(r.result.current.range.live).toBe(false)
    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(r.result.current.range.from).toBe(from)
    expect(r.result.current.range.to).toBe(to)
  })

  it('preserves an unrelated param (an open receipt) when changing range', () => {
    const r = harness(['/?receipt=rcpt_1'])
    act(() => r.result.current.range.setPreset('7d'))
    const p = search(r)
    expect(p.get('receipt')).toBe('rcpt_1')
    expect(p.get('range')).toBe('7d')
  })
})
