// The six states every async read-surface can be in, and the one rule that
// matters: a degraded surface is never rendered as an empty one. The spec's
// cross-cutting states (§7.6) and the resolved Q7 decision both insist that a
// stale pipeline must show its last-known data *marked as stale*, not a blank
// "no data" panel that lies about what the gateway knows.
//
// `ready` and `stale` are the two "we have data" states — `stale` renders the
// same data with a degradation marker. The other four replace the content:
// `loading` (first load, nothing yet), `error` (load failed, nothing usable),
// `empty` (genuinely nothing to show), `denied` (authz — you get nothing
// regardless of what data exists).
export type SurfaceStateKind =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'stale'
  | 'denied'

export type SurfaceFlags = {
  /** Caller lacks the role to view this surface — overrides everything. */
  denied?: boolean
  /** We hold last-known data but the pipeline feeding it is stale/degraded. */
  stale?: boolean
  /** First load with nothing to show yet. */
  loading?: boolean
  /** Load failed with no usable data. */
  error?: boolean
  /** Loaded successfully and there is genuinely nothing to show. */
  isEmpty?: boolean
}

/**
 * Collapse a surface's flags to the single state it should render.
 *
 * Precedence is the whole point:
 *  1. `denied` — a security gate; nothing renders regardless of data.
 *  2. `stale`  — as long as last-known data exists, show it *marked*. This
 *     beats loading/error/empty so a degraded pipeline can never masquerade as
 *     a skeleton, an error, or (the cardinal sin) an empty state.
 *  3. `loading` / `error` / `empty` — the "no usable data" states, in the order
 *     a caller would want them: still-arriving, failed, then genuinely empty.
 *  4. `ready` — data, no degradation.
 */
export function surfaceState(flags: SurfaceFlags): SurfaceStateKind {
  if (flags.denied) return 'denied'
  if (flags.stale) return 'stale'
  if (flags.loading) return 'loading'
  if (flags.error) return 'error'
  if (flags.isEmpty) return 'empty'
  return 'ready'
}
