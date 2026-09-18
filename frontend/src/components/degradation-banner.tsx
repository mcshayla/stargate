import {
  CloudOff,
  DatabaseZap,
  ShieldAlert,
  Shuffle,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { canDismissDegradation } from '@/lib/degradation'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  Degradation,
  DegradationKind,
  DegradationSeverity,
} from '@/lib/types'

// Kind → glyph + label lives here so the icon and text stay in lockstep, the
// same one-source-of-truth idiom as verdict-badge and change-event. A
// degradation is never signalled by color alone — the glyph and title always
// travel with it.
const KIND: Record<DegradationKind, { icon: LucideIcon; label: string }> = {
  'fail-open': { icon: ShieldAlert, label: 'Guardrails open' },
  'control-plane': { icon: CloudOff, label: 'Control plane' },
  failover: { icon: Shuffle, label: 'Failover' },
  'cache-stale': { icon: DatabaseZap, label: 'Cache stale' },
}

// Severity → tint, drawn from the semantic tokens so it matches the verdict
// ramp: critical = destructive, warning = warning, info = info.
const SEVERITY_TINT: Record<DegradationSeverity, string> = {
  critical: 'border-destructive bg-destructive text-destructive-foreground',
  warning: 'border-warning bg-warning text-warning-foreground',
  info: 'border-info bg-info text-info-foreground',
}

function since(d: Degradation, now: number): string | null {
  if (!d.since) return null
  return d.kind === 'cache-stale'
    ? `cached ${formatRelative(d.since, now)}`
    : `active ${formatRelative(d.since, now)}`
}

/** One row of banner content — reused for the lead banner and the extra list. */
function DegradationRow({
  degradation,
  now,
  onDismiss,
  compact = false,
}: {
  degradation: Degradation
  now: number
  onDismiss?: (id: string) => void
  compact?: boolean
}) {
  const meta = KIND[degradation.kind]
  const Icon = meta.icon
  const age = since(degradation, now)
  const dismissible = onDismiss !== undefined && canDismissDegradation(degradation)

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon aria-hidden className={cn('mt-0.5 shrink-0', compact ? 'size-4' : 'size-4')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {meta.label}
          </span>
          <span className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>
            {degradation.title}
          </span>
          {age && (
            <span className="text-xs opacity-70 tabular-nums">· {age}</span>
          )}
        </div>
        <p className={cn('opacity-90', compact ? 'text-xs' : 'text-xs')}>
          {degradation.detail}
        </p>
      </div>
      {degradation.href && (
        <Button
          className="h-6 shrink-0 px-2 text-xs hover:no-underline"
          render={<Link to={degradation.href} />}
          size="sm"
          variant="ghost"
        >
          View
        </Button>
      )}
      {dismissible && (
        <Button
          aria-label={`Dismiss ${degradation.title}`}
          className="size-6 shrink-0"
          onClick={() => onDismiss?.(degradation.id)}
          size="icon-xs"
          variant="ghost"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

/**
 * The global degradation banner (spec §7.4): one slot, ranked by severity. It
 * shows the single worst active degradation and, when more exist, a count that
 * expands the rest in place. Fail-opens carry a non-dismissible, assertive
 * `alert` role; everything else is a polite `status`.
 *
 * Presentational and pure — pass the already-ranked `degradations` (worst
 * first) and a `now` for the age clock. Renders nothing when the list is empty.
 */
export function DegradationBanner({
  degradations,
  now,
  onDismiss,
}: {
  degradations: Degradation[]
  now: number
  onDismiss?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (degradations.length === 0) return null

  const [lead, ...rest] = degradations
  // A fail-open passing requests unchecked is the one thing that should
  // interrupt a screen reader; the rest are polite status updates.
  const assertive = lead.kind === 'fail-open'

  return (
    <div
      className={cn(
        'shrink-0 border-b px-4 py-2.5',
        SEVERITY_TINT[lead.severity],
      )}
      data-slot="degradation-banner"
      data-kind={lead.kind}
      data-severity={lead.severity}
      role={assertive ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <DegradationRow degradation={lead} now={now} onDismiss={onDismiss} />
        </div>
        {rest.length > 0 && (
          <Button
            aria-expanded={expanded}
            className="h-6 shrink-0 px-2 text-xs hover:no-underline"
            onClick={() => setExpanded((v) => !v)}
            size="sm"
            variant="ghost"
          >
            {expanded ? 'Hide' : `+${rest.length} more`}
          </Button>
        )}
      </div>

      {expanded && rest.length > 0 && (
        <ul className="mt-2.5 space-y-2 border-t border-current/20 pt-2.5">
          {rest.map((d) => (
            <li key={d.id}>
              <DegradationRow
                compact
                degradation={d}
                now={now}
                onDismiss={onDismiss}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
