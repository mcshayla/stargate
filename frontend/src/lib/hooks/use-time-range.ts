import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PRESETS,
  type Preset,
  type PresetId,
  type ResolvedWindow,
  type TimeRangeSelection,
  isLive,
  parseTimeRange,
  presetById,
  resolveWindow,
  serializeTimeRange,
} from '@/lib/time-range'

// The shared window for the Observe surfaces. Like `use-traffic-filters`, the
// URL is the source of truth — navigating from Overview to Traffic inherits the
// window, and any windowed view pastes into an incident as a reproducible link.
//
// The `now` clock only ticks while the selection is relative (live): the window
// silently slides forward so "last 24h" stays current. Pinning to an absolute
// span stops the clock entirely, so a chart never re-renders under the cursor
// mid-inspection (the pin-kills-auto-refresh rule).

/** How often a live (relative) window re-anchors to the current instant. */
const LIVE_TICK_MS = 15_000

export type TimeRange = {
  selection: TimeRangeSelection
  /** True while the window auto-refreshes; false when pinned to absolute. */
  live: boolean
  /** Resolved window start (epoch ms). */
  from: number
  /** Resolved window end (epoch ms). */
  to: number
  /** The instant the window is currently anchored to. */
  now: number
  /** Human label for the active window, e.g. "last 24h" or a pinned span. */
  label: string
  presets: Preset[]
  /** Switch to a relative preset (resumes live sliding). */
  setPreset: (preset: PresetId) => void
  /** Pin to a fixed span (stops auto-refresh). */
  pin: (from: number, to: number) => void
}

const ABSOLUTE_LABEL_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

export function useTimeRange(): TimeRange {
  const [params, setParams] = useSearchParams()

  const selection = useMemo(() => parseTimeRange(params), [params])
  const live = isLive(selection)

  // Anchor for relative windows. Frozen while pinned so the view holds still.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    // Subscribing to the wall clock: re-sync immediately on entering live mode
    // (so returning from a pinned window snaps to the present rather than the
    // stale frozen instant), then keep sliding on the tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), LIVE_TICK_MS)
    return () => clearInterval(id)
  }, [live])

  const window: ResolvedWindow = useMemo(
    () => resolveWindow(selection, now),
    [selection, now],
  )

  // Replace history (don't push) so nudging the range doesn't bury Back — same
  // choice as the traffic filters — while the address bar still shares state.
  const commit = useCallback(
    (next: TimeRangeSelection) => {
      setParams((prev) => serializeTimeRange(next, prev), { replace: true })
    },
    [setParams],
  )

  const setPreset = useCallback(
    (preset: PresetId) => commit({ kind: 'relative', preset }),
    [commit],
  )

  const pin = useCallback(
    (from: number, to: number) => commit({ kind: 'absolute', from, to }),
    [commit],
  )

  const label = useMemo(() => {
    if (selection.kind === 'relative') {
      return `last ${presetById(selection.preset)?.label ?? ''}`
    }
    const fmt = (ms: number) =>
      new Date(ms).toLocaleString(undefined, ABSOLUTE_LABEL_OPTS)
    return `${fmt(window.from)} → ${fmt(window.to)}`
  }, [selection, window.from, window.to])

  return {
    selection,
    live,
    from: window.from,
    to: window.to,
    now,
    label,
    presets: PRESETS,
    setPreset,
    pin,
  }
}
