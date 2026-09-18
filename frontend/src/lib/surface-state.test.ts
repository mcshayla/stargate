import { describe, expect, it } from 'vitest'
import { surfaceState } from './surface-state'

describe('surfaceState precedence', () => {
  it('defaults to ready when no flags are set', () => {
    expect(surfaceState({})).toBe('ready')
  })

  it('renders ready as the has-data, no-degradation state', () => {
    expect(surfaceState({ isEmpty: false })).toBe('ready')
  })

  it('reports each state when it is the only flag', () => {
    expect(surfaceState({ denied: true })).toBe('denied')
    expect(surfaceState({ stale: true })).toBe('stale')
    expect(surfaceState({ loading: true })).toBe('loading')
    expect(surfaceState({ error: true })).toBe('error')
    expect(surfaceState({ isEmpty: true })).toBe('empty')
  })

  it('lets denied override every other flag (security gate)', () => {
    expect(
      surfaceState({
        denied: true,
        stale: true,
        loading: true,
        error: true,
        isEmpty: true,
      }),
    ).toBe('denied')
  })

  it('never renders a degraded surface as empty, loading, or error', () => {
    // The whole reason this resolver exists: as long as last-known data is
    // present (stale), it wins over the "no data" states.
    expect(surfaceState({ stale: true, isEmpty: true })).toBe('stale')
    expect(surfaceState({ stale: true, loading: true })).toBe('stale')
    expect(surfaceState({ stale: true, error: true })).toBe('stale')
  })

  it('orders the no-data states loading > error > empty', () => {
    expect(surfaceState({ loading: true, error: true, isEmpty: true })).toBe(
      'loading',
    )
    expect(surfaceState({ error: true, isEmpty: true })).toBe('error')
  })
})
