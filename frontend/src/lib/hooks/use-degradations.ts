import { useCallback, useMemo, useState } from 'react'
import { degradations as source } from '@/lib/mock/degradations'
import { canDismissDegradation, rankDegradations } from '@/lib/degradation'
import type { Degradation } from '@/lib/types'

export type Degradations = {
  /** Active, non-dismissed degradations, ranked worst-first. */
  active: Degradation[]
  /** Hide a dismissible degradation for this session. */
  dismiss: (id: string) => void
}

/**
 * Reads the current gateway degradations for the global banner. Today it wraps
 * the mock list and tracks per-session dismissals in local state; swap the
 * source for the control-plane health subscription and the banner is unchanged.
 * Fail-opens can't be dismissed (enforced by {@link canDismissDegradation}), so
 * a dismiss request for one is silently a no-op.
 */
export function useDegradations(source_ = source): Degradations {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const active = useMemo(
    () => rankDegradations(source_.filter((d) => !dismissed.has(d.id))),
    [source_, dismissed],
  )

  const dismiss = useCallback(
    (id: string) => {
      const target = source_.find((d) => d.id === id)
      if (target && !canDismissDegradation(target)) return
      setDismissed((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    },
    [source_],
  )

  return { active, dismiss }
}
