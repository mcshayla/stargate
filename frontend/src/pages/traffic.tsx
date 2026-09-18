import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { ReceiptDrawer } from '@/components/receipt-drawer'
import { StreamTable, type StreamColumn } from '@/components/stream-table'
import { TrafficFilters } from '@/components/traffic-filters'
import { Button } from '@/components/ui/button'
import { VerdictBadge, verdictBarColor } from '@/components/verdict-badge'
import { Duration, Money, TokenCount } from '@/components/values'
import { useLiveStream } from '@/lib/hooks/use-live-stream'
import { useTimeRange } from '@/lib/hooks/use-time-range'
import { useTrafficFilters } from '@/lib/hooks/use-traffic-filters'
import { formatClock, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { receipts } from '@/lib/mock/receipts'
import type { Receipt } from '@/lib/types'

const RECEIPT_PARAM = 'receipt'

// Distinct requested models, for the model filter's picker. Drawn from the
// backlog (stable across the session) rather than the live rows, so the option
// list doesn't churn as traffic arrives.
const MODELS = [...new Set(receipts.map((r) => r.modelRequested))].sort()

const columns: StreamColumn<Receipt>[] = [
  {
    id: 'verdict',
    header: 'Verdict',
    className: 'w-[136px]',
    // Verdict leads with a color bar (spec §7.5.3), reinforcing the badge's
    // glyph + label — never color alone.
    cell: (r) => (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-4 w-1 shrink-0 rounded-full',
            verdictBarColor(r.verdict),
          )}
        />
        <VerdictBadge verdict={r.verdict} />
      </div>
    ),
  },
  {
    id: 'ts',
    header: 'Time',
    className: 'w-[92px]',
    cell: (r) => (
      <span className="font-mono tabular-nums text-muted-foreground">
        {formatClock(r.ts)}
      </span>
    ),
  },
  {
    id: 'key',
    header: 'Key',
    cell: (r) => <span className="font-mono text-xs">{r.key}</span>,
  },
  {
    id: 'model',
    header: 'Model',
    cell: (r) => <span className="font-mono text-xs">{r.modelRequested}</span>,
  },
  {
    id: 'tokens',
    header: 'Tokens (in/out)',
    // Cost travels next to latency and tokens so the three read together.
    cell: (r) => (
      <span className="text-muted-foreground">
        <TokenCount value={r.tokens.input} />
        <span className="mx-1 opacity-40">/</span>
        <TokenCount value={r.tokens.output} />
      </span>
    ),
  },
  {
    id: 'cost',
    header: 'Cost',
    cell: (r) => <Money value={r.costUsd} precise />,
  },
  {
    id: 'latency',
    header: 'Latency',
    cell: (r) => <Duration ms={r.durationMs} />,
  },
]

export function TrafficPage() {
  const filters = useTrafficFilters()
  const { from, to, live } = useTimeRange()
  const stream = useLiveStream({ seed: receipts })
  const [params, setParams] = useSearchParams()

  // Scope the stream to the shared window. While live (relative), only clamp the
  // lower bound: the resolved `to` re-anchors on a 15s tick, so enforcing it
  // would briefly hide rows minted between ticks. A pinned window clamps both.
  const inWindow = useCallback(
    (r: Receipt) => {
      const t = new Date(r.ts).getTime()
      return live ? t >= from : t >= from && t <= to
    },
    [from, to, live],
  )

  // A ticking clock so the "updated Xs ago" stamp stays honest even while the
  // stream is frozen and not otherwise re-rendering (freshness rule, Q7).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // The open receipt is addressable via ?receipt=<id> (Q2), so a peek is
  // shareable and Back closes the drawer. Resolve against the live rows first,
  // then the backlog for a cold link.
  const receiptId = params.get(RECEIPT_PARAM)
  const selected = useMemo(() => {
    if (!receiptId) return null
    return (
      stream.rows.find((r) => r.id === receiptId) ??
      receipts.find((r) => r.id === receiptId) ??
      null
    )
  }, [receiptId, stream.rows])

  const openReceipt = useCallback(
    (receipt: Receipt) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(RECEIPT_PARAM, receipt.id)
          return next
        },
        { replace: false },
      )
    },
    [setParams],
  )
  const closeReceipt = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(RECEIPT_PARAM)
        return next
      },
      { replace: false },
    )
  }, [setParams])

  // Freeze the stream while the user is reading it — hovering/focusing the
  // table or holding a receipt open — so rows never shift underfoot and focus
  // is never stolen.
  const [interacting, setInteracting] = useState(false)
  const drawerOpen = selected !== null
  const { setFrozen } = stream
  useEffect(() => {
    setFrozen(interacting || drawerOpen)
  }, [interacting, drawerOpen, setFrozen])

  // Rows inside the window, before the traffic filters narrow further — the
  // honest denominator for "N of M".
  const windowRows = useMemo(
    () => stream.rows.filter(inWindow),
    [stream.rows, inWindow],
  )
  const visibleRows = useMemo(
    () => windowRows.filter(filters.matches),
    [windowRows, filters],
  )
  // The pill counts only queued rows the current filter + window would actually
  // show, so it never promises rows that won't appear on flush.
  const pendingCount = useMemo(
    () => stream.pending.filter((r) => inWindow(r) && filters.matches(r)).length,
    [stream.pending, filters, inWindow],
  )

  const emptyState = (
    <div className="flex min-h-60 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-medium">
        {filters.active
          ? 'No requests match these filters.'
          : 'No requests in this window.'}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filters.active
          ? 'Loosen a verdict, model, or search term to see more.'
          : 'New requests will appear here as they arrive.'}
      </p>
      {filters.active ? (
        <Button className="mt-1" onClick={filters.clear} variant="outline">
          Clear filters
        </Button>
      ) : null}
    </div>
  )

  return (
    <AppShell
      title="Traffic"
      description="Live request stream. Every row drills to its receipt."
      actions={
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <span
            className={cn(
              'size-1.5 rounded-full',
              stream.frozen
                ? 'bg-muted-foreground'
                : 'bg-success-foreground motion-safe:animate-pulse',
            )}
          />
          {stream.frozen ? 'Paused' : 'Live'} · updated{' '}
          {formatRelative(new Date(stream.lastArrivalAt).toISOString(), now)}
        </span>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <TrafficFilters filters={filters} models={MODELS} />
        <p
          aria-live="polite"
          className="text-xs text-muted-foreground tabular-nums"
        >
          {visibleRows.length}
          {filters.active ? ` of ${windowRows.length}` : ''} request
          {visibleRows.length === 1 ? '' : 's'}
          {filters.active ? ' shown' : ''}
        </p>
        <StreamTable
          activeRowId={selected?.id ?? null}
          ariaLabel="Request traffic"
          columns={columns}
          emptyState={emptyState}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.id}
          newIds={stream.newIds}
          onActivate={openReceipt}
          onFlush={stream.flush}
          onInteractingChange={setInteracting}
          pendingCount={pendingCount}
          rows={visibleRows}
        />
      </div>
      <ReceiptDrawer receipt={selected} onClose={closeReceipt} />
    </AppShell>
  )
}
