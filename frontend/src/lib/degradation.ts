import type {
  Degradation,
  DegradationKind,
  DegradationSeverity,
} from '@/lib/types'

// "One banner slot, ranked by severity" (spec §7.4). The console never stacks
// degradation banners; it shows the single worst one and counts the rest. That
// makes the ranking the load-bearing piece — it decides what an operator sees
// first when several things are wrong at once.

const SEVERITY_RANK: Record<DegradationSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

// Tie-break within a severity. A fail-open is a security event — requests are
// passing unchecked — so it outranks anything else of equal loudness.
const KIND_RANK: Record<DegradationKind, number> = {
  'fail-open': 4,
  'control-plane': 3,
  failover: 2,
  'cache-stale': 1,
}

export function severityRank(severity: DegradationSeverity): number {
  return SEVERITY_RANK[severity]
}

/**
 * Sort degradations worst-first: by severity, then by kind (fail-open wins
 * ties), then oldest-first so the longest-running issue leads among equals.
 * Pure and non-mutating — returns a new array.
 */
export function rankDegradations(list: readonly Degradation[]): Degradation[] {
  return [...list].sort((a, b) => {
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) {
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    }
    if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) {
      return KIND_RANK[b.kind] - KIND_RANK[a.kind]
    }
    // Older first — the longer something has been degraded, the more it leads.
    const at = a.since ? new Date(a.since).getTime() : Number.POSITIVE_INFINITY
    const bt = b.since ? new Date(b.since).getTime() : Number.POSITIVE_INFINITY
    return at - bt
  })
}

/** The loudest severity in the set, or null when nothing is degraded. */
export function worstSeverity(
  list: readonly Degradation[],
): DegradationSeverity | null {
  let worst: DegradationSeverity | null = null
  for (const d of list) {
    if (worst === null || SEVERITY_RANK[d.severity] > SEVERITY_RANK[worst]) {
      worst = d.severity
    }
  }
  return worst
}

/**
 * Whether an operator may dismiss a degradation's banner. A fail-open stays
 * pinned while active no matter what the record says (spec §7.6): you don't get
 * to hide the fact that your guardrails are open.
 */
export function canDismissDegradation(d: Degradation): boolean {
  return d.dismissible && d.kind !== 'fail-open'
}
