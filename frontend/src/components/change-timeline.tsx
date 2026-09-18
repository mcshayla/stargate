import {
  ChangeKindIcon,
  ChangeSourceBadge,
  changeKindLabel,
} from '@/components/change-event'
import { changesInWindow } from '@/lib/series'
import { cn } from '@/lib/utils'
import type { ChangeEvent } from '@/lib/types'

// Overview's "what changed" timeline (plan §7 Q5). Two coupled views of the same
// curated feed of consequential changes:
//   • a rail whose ticks sit on the *same* [from, to] domain as the traffic
//     charts above it, so a change lines up under the effect it may have had —
//     correlation, never causation (no arrows, no claim of cause);
//   • a list beneath that carries the detail and doubles as the keyboard /
//     assistive-tech equivalent, the way every chart primitive ships a table.
// Filtering + positioning is the pure `changesInWindow` selector; this component
// only draws it.

export interface ChangeTimelineProps {
  /** The full change feed; the component windows + positions it internally. */
  changes: ChangeEvent[]
  /** Window bounds in epoch ms — the same range the surface's charts use. */
  from: number
  to: number
  /** Accessible name for the region and list. */
  label?: string
  /** Formats a change's ISO timestamp for display (the page owns locale). */
  formatTime?: (iso: string) => string
  /** Activating a tick or a list row calls this — the drill-to-Traffic seam. */
  onSelect?: (event: ChangeEvent) => void
  className?: string
}

export function ChangeTimeline({
  changes,
  from,
  to,
  label = 'What changed',
  formatTime = String,
  onSelect,
  className,
}: ChangeTimelineProps) {
  const positioned = changesInWindow(changes, { from, to })

  if (positioned.length === 0) {
    return (
      <div
        data-slot="change-timeline"
        role="group"
        aria-label={label}
        className={cn(
          'flex items-center justify-center py-6 text-xs text-muted-foreground',
          className,
        )}
      >
        No changes in this range
      </div>
    )
  }

  return (
    <div
      data-slot="change-timeline"
      role="group"
      aria-label={label}
      className={cn('space-y-3', className)}
    >
      {/* Rail — ticks on the shared time domain. Purely spatial correlation. */}
      <div className="relative h-6">
        <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border" />
        {positioned.map(({ event, pct }) => (
          <button
            key={event.id}
            type="button"
            data-slot="change-tick"
            data-id={event.id}
            data-kind={event.kind}
            title={`${event.title} · ${formatTime(event.ts)}`}
            aria-label={`${changeKindLabel(event.kind)}: ${event.title} — ${formatTime(event.ts)}`}
            onClick={() => onSelect?.(event)}
            style={{ left: `${pct * 100}%` }}
            className="absolute top-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-foreground focus-visible:border-foreground focus-visible:outline-none"
          >
            <ChangeKindIcon kind={event.kind} className="size-3" />
          </button>
        ))}
      </div>

      {/* List — the scannable detail + the accessible equivalent of the rail. */}
      <ol aria-label={label} className="divide-y divide-border">
        {positioned.map(({ event }) => (
          <li key={event.id} className="flex items-start gap-3 py-2">
            <time className="mt-0.5 w-14 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {formatTime(event.ts)}
            </time>
            <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <ChangeKindIcon kind={event.kind} />
              {changeKindLabel(event.kind)}
            </span>
            <div className="min-w-0 flex-1">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(event)}
                  className="text-left text-sm font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {event.title}
                </button>
              ) : (
                <span className="text-sm font-medium">{event.title}</span>
              )}
              <p className="text-xs text-muted-foreground">{event.detail}</p>
            </div>
            <ChangeSourceBadge source={event.source} className="mt-0.5 shrink-0" />
          </li>
        ))}
      </ol>
    </div>
  )
}
