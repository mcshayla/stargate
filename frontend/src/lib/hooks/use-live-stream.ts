import { useCallback, useEffect, useRef, useState } from 'react'
import { mintReceipt } from '@/lib/mock/receipts'
import type { Receipt } from '@/lib/types'

// The stream is bounded so a long-running session can't grow the DOM without
// limit — old rows fall off the bottom. Traffic is a live window, not an
// archive; anything older is reachable through search/receipt links.
const MAX_ROWS = 200

// How long a freshly-inserted row wears its entry tint. Matches the CSS
// `nebari-row-tint` animation so the flag clears just as the color finishes
// fading — no lingering highlight, no re-trigger on the next poll.
const TINT_MS = 1100

export type LiveStream = {
  /** Rows newest-first, capped at {@link MAX_ROWS}. */
  rows: Receipt[]
  /** Ids inserted within the last tint window — drives the entry animation. */
  newIds: ReadonlySet<string>
  /** Rows that arrived while frozen, waiting behind the "N new" pill. */
  pending: Receipt[]
  /** True while insertion is paused (hover / focus / open drawer). */
  frozen: boolean
  /** Pause or resume insertion. Resuming flushes the pending buffer. */
  setFrozen: (value: boolean) => void
  /** Insert the pending buffer now, as one batched, tinted arrival. */
  flush: () => void
  /** Epoch ms of the last insertion — feeds the "updated Xs ago" stamp. */
  lastArrivalAt: number
}

// Bursty but calm: usually a single row, sometimes a small batch, often
// nothing — so the stream breathes rather than metronomes.
function rollArrivalCount(): number {
  const r = Math.random()
  if (r < 0.25) return 0
  if (r < 0.8) return 1
  if (r < 0.95) return 2
  return 3
}

/**
 * Simulated live request stream for Phase 1. Polls on an interval and
 * top-inserts freshly minted receipts, batching each tick's arrivals into a
 * single tinted entry. Hovering/focusing the table freezes insertion and
 * queues arrivals behind a "N new" pill so rows never shift under the cursor
 * and focus is never stolen (the "live but calm" decision, Q3).
 *
 * The poll loop is the only backend-shaped seam: swap {@link mintReceipt} +
 * the interval for an SSE/WebSocket "rows since cursor" subscription and every
 * consumer stays unchanged.
 */
export function useLiveStream({
  seed,
  intervalMs = 3500,
}: {
  /** Initial backlog, newest-first. */
  seed: Receipt[]
  /** Poll cadence. */
  intervalMs?: number
}): LiveStream {
  const [rows, setRows] = useState<Receipt[]>(() => seed.slice(0, MAX_ROWS))
  const [pending, setPending] = useState<Receipt[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  const [lastArrivalAt, setLastArrivalAt] = useState<number>(() => Date.now())
  const [frozen, setFrozenState] = useState(false)

  // Mirrors read synchronously inside the interval callback, where the latest
  // state value isn't in scope.
  const frozenRef = useRef(false)
  const pendingRef = useRef<Receipt[]>([])

  const markNew = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setNewIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    window.setTimeout(() => {
      setNewIds((prev) => {
        if (ids.every((id) => !prev.has(id))) return prev
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, TINT_MS)
  }, [])

  const insert = useCallback(
    (incoming: Receipt[]) => {
      if (incoming.length === 0) return
      setRows((prev) => [...incoming, ...prev].slice(0, MAX_ROWS))
      markNew(incoming.map((r) => r.id))
      setLastArrivalAt(Date.now())
    },
    [markNew],
  )

  const flush = useCallback(() => {
    const buffered = pendingRef.current
    if (buffered.length === 0) return
    pendingRef.current = []
    setPending([])
    insert(buffered)
  }, [insert])

  const setFrozen = useCallback(
    (value: boolean) => {
      if (frozenRef.current === value) return
      frozenRef.current = value
      setFrozenState(value)
      // Resuming flushes what queued so the pill never lingers after unfreeze.
      if (!value) flush()
    },
    [flush],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      const count = rollArrivalCount()
      if (count === 0) return
      // Reverse so the most-recently-minted receipt lands on top (newest-first).
      const arrivals = Array.from({ length: count }, () => mintReceipt()).reverse()
      if (frozenRef.current) {
        pendingRef.current = [...arrivals, ...pendingRef.current]
        setPending(pendingRef.current)
      } else {
        insert(arrivals)
      }
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, insert])

  return { rows, newIds, pending, frozen, setFrozen, flush, lastArrivalAt }
}
