import {
  CircleAlertIcon,
  ClockIcon,
  InboxIcon,
  LockIcon,
  RefreshCwIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { surfaceState } from '@/lib/surface-state'
import type { SurfaceFlags, SurfaceStateKind } from '@/lib/surface-state'
import { cn } from '@/lib/utils'

/**
 * Centered icon / title / description / action block that stands in for the
 * surface content when there is nothing (or nothing trustworthy) to show.
 * Mirrors DataTableState so a panel and a table read the same in every state.
 * `variant="error"` colors the icon and promotes the region from a polite
 * `status` to an assertive `alert`.
 */
function StateBlock({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  variant?: 'default' | 'error'
}) {
  return (
    <div
      className="flex min-h-60 flex-col items-center justify-center gap-2 px-6 py-10 text-center"
      data-slot="surface-state-block"
      data-variant={variant}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mb-1 text-muted-foreground',
          variant === 'error' && 'text-destructive-foreground',
        )}
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description == null ? null : (
        <div className="max-w-sm text-sm leading-5 text-muted-foreground">
          {description}
        </div>
      )}
      {action == null ? null : <div className="mt-1">{action}</div>}
    </div>
  )
}

export type SurfaceStateProps = SurfaceFlags & {
  /**
   * Force the rendered state. When omitted, it is derived from the
   * {@link SurfaceFlags} on the same props via {@link surfaceState} — pass the
   * flags and let the precedence rules decide.
   */
  state?: SurfaceStateKind
  children: ReactNode
  /** Shown while `loading`; defaults to a centered spinner. */
  loadingFallback?: ReactNode
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
  /**
   * Error-state description; falls back to a generic connection message. Named
   * apart from the `error` boolean flag so a message and the state that shows
   * it never collide.
   */
  errorMessage?: ReactNode
  /** Retry affordance shown in the error state. */
  onRetry?: () => void
  /**
   * Marker copy for the `stale` state, e.g. "Showing data from 2 minutes ago".
   * The children still render beneath it — degraded is never blank.
   */
  staleLabel?: ReactNode
  /** Optional refresh affordance rendered inside the stale marker. */
  onRefresh?: () => void
  /** Role required to view the surface, shown in the `denied` state. */
  deniedRole?: string
  /** Who to ask for access, shown in the `denied` state. */
  deniedContact?: string
  className?: string
}

/**
 * Wraps any async read-surface (a card, a panel, a chart region) and renders
 * the one treatment its state calls for. The `stale` case is the reason this
 * exists: it renders a degradation marker *above the live children* so a
 * degraded pipeline shows its last-known data instead of collapsing to an
 * empty or error state (spec §7.6, Q7). For tables, DataTable already owns its
 * own states — reach for this on everything that isn't one.
 */
export function SurfaceState({
  state,
  children,
  loadingFallback,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Data will appear here once the gateway sees traffic.',
  emptyAction,
  errorMessage,
  onRetry,
  staleLabel = 'Showing the last data we received — the live feed is degraded.',
  onRefresh,
  deniedRole,
  deniedContact,
  className,
  ...flags
}: SurfaceStateProps) {
  const resolved = state ?? surfaceState(flags)

  const content = (() => {
    switch (resolved) {
      case 'loading':
        return (
          loadingFallback ?? (
            <div
              aria-busy="true"
              className="flex min-h-60 items-center justify-center"
              data-slot="surface-state-loading"
              role="status"
            >
              <Spinner aria-hidden />
              <span className="sr-only">Loading</span>
            </div>
          )
        )
      case 'empty':
        return (
          <StateBlock
            action={emptyAction}
            description={emptyDescription}
            icon={<InboxIcon className="size-6" />}
            title={emptyTitle}
          />
        )
      case 'error':
        return (
          <StateBlock
            action={
              onRetry === undefined ? null : (
                <Button onClick={onRetry} variant="outline">
                  <RefreshCwIcon />
                  Retry
                </Button>
              )
            }
            description={
              errorMessage == null
                ? 'There was a problem reaching the gateway. Check your connection and try again.'
                : errorMessage
            }
            icon={<CircleAlertIcon className="size-6" strokeWidth={1.5} />}
            title="Couldn’t load this"
            variant="error"
          />
        )
      case 'denied':
        return (
          <StateBlock
            description={
              <>
                {deniedRole
                  ? `This surface requires the ${deniedRole} role.`
                  : 'You don’t have access to this surface.'}
                {deniedContact ? ` Contact ${deniedContact} for access.` : null}
              </>
            }
            icon={<LockIcon className="size-6" />}
            title="Access required"
          />
        )
      case 'stale':
        // The crux: the children stay on screen. The marker explains *why*
        // they might be behind; it never replaces them.
        return (
          <div data-slot="surface-state-stale">
            <div
              className="mb-3 flex items-center gap-2 rounded-md border border-warning bg-warning px-3 py-2 text-xs text-warning-foreground"
              data-slot="surface-state-stale-marker"
              role="status"
            >
              <ClockIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{staleLabel}</span>
              {onRefresh === undefined ? null : (
                <Button
                  className="h-6 px-2 text-xs"
                  onClick={onRefresh}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Refresh
                </Button>
              )}
            </div>
            {children}
          </div>
        )
      case 'ready':
        return children
    }
  })()

  return (
    <div className={cn('min-w-0', className)} data-slot="surface-state" data-state={resolved}>
      {content}
    </div>
  )
}
