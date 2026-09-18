// Pure, locale-free time-range logic shared across the Observe surfaces
// (Overview / Traffic / Spend). The URL is canonical — same idiom as
// `use-traffic-filters` — so any windowed view is shareable and reproducible;
// this module owns the parse/serialize/resolve rules and stays free of React
// and of `now`, which callers inject so the logic is deterministic to test.

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type PresetId = '1h' | '6h' | '24h' | '7d' | '30d'

export type Preset = {
  id: PresetId
  /** Terse label for the segmented control. */
  label: string
  /** Span in milliseconds. */
  ms: number
}

// Biased short on purpose: token dashboards live and die by "did it spike in
// the last hour," so the near end is denser than a typical analytics tool.
export const PRESETS: Preset[] = [
  { id: '1h', label: '1h', ms: HOUR },
  { id: '6h', label: '6h', ms: 6 * HOUR },
  { id: '24h', label: '24h', ms: DAY },
  { id: '7d', label: '7d', ms: 7 * DAY },
  { id: '30d', label: '30d', ms: 30 * DAY },
]

export const DEFAULT_PRESET: PresetId = '1h'

/**
 * The user's selection. `relative` auto-refreshes (the window slides forward as
 * time passes); `absolute` is pinned to a fixed span and never moves — which is
 * what lets us kill auto-refresh so a chart never re-renders under the cursor.
 */
export type TimeRangeSelection =
  | { kind: 'relative'; preset: PresetId }
  | { kind: 'absolute'; from: number; to: number } // epoch ms

/** A concrete [from, to] span in epoch ms, resolved against a given `now`. */
export type ResolvedWindow = { from: number; to: number }

const RANGE_PARAM = 'range'
const FROM_PARAM = 'from'
const TO_PARAM = 'to'

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}

const relativeDefault: TimeRangeSelection = {
  kind: 'relative',
  preset: DEFAULT_PRESET,
}

/**
 * Read the selection from the URL. A valid absolute `?from`/`?to` wins over a
 * relative `?range` — a shared pinned link should reproduce exactly, even if a
 * stale `?range` rides along. Anything malformed falls back to the default so a
 * hand-edited URL degrades gracefully rather than throwing.
 */
export function parseTimeRange(params: URLSearchParams): TimeRangeSelection {
  const rawFrom = params.get(FROM_PARAM)
  const rawTo = params.get(TO_PARAM)
  if (rawFrom && rawTo) {
    const from = Date.parse(rawFrom)
    const to = Date.parse(rawTo)
    if (!Number.isNaN(from) && !Number.isNaN(to) && from < to) {
      return { kind: 'absolute', from, to }
    }
  }

  const range = params.get(RANGE_PARAM)
  if (range && presetById(range)) {
    return { kind: 'relative', preset: range as PresetId }
  }

  return relativeDefault
}

/**
 * Project a selection onto a copy of `base`, preserving unrelated params
 * (an open `?receipt`, an active verdict filter). Relative and absolute are
 * mutually exclusive in the URL, so writing one always clears the other.
 */
export function serializeTimeRange(
  selection: TimeRangeSelection,
  base: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(base)
  if (selection.kind === 'relative') {
    next.set(RANGE_PARAM, selection.preset)
    next.delete(FROM_PARAM)
    next.delete(TO_PARAM)
  } else {
    next.delete(RANGE_PARAM)
    next.set(FROM_PARAM, new Date(selection.from).toISOString())
    next.set(TO_PARAM, new Date(selection.to).toISOString())
  }
  return next
}

/** Resolve a selection to a concrete window. Relative ends at `now`. */
export function resolveWindow(
  selection: TimeRangeSelection,
  now: number,
): ResolvedWindow {
  if (selection.kind === 'absolute') {
    return { from: selection.from, to: selection.to }
  }
  const preset = presetById(selection.preset) ?? PRESETS[0]
  return { from: now - preset.ms, to: now }
}

/** True when the window auto-refreshes (relative); false when pinned. */
export function isLive(selection: TimeRangeSelection): boolean {
  return selection.kind === 'relative'
}
