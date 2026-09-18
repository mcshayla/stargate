// Mock system-health degradations for the Phase 1 read-only surfaces. Swap this
// module for the control-plane health feed once the backend lands — every
// consumer reads the {@link Degradation} shape, not this list.
//
// Seeded to match the Overview health strip (OpenAI failing over) so the banner
// and the strip tell the same story. Deliberately no fail-open here: an open
// guardrail is the loudest, non-dismissible state and shouldn't be the resting
// demo experience — but the banner and ranking handle it when it occurs.

import type { Degradation } from '@/lib/types'

const NOW = Date.now()
const minsAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

export const degradations: Degradation[] = [
  {
    id: 'deg-openai-failover',
    kind: 'failover',
    severity: 'warning',
    title: 'OpenAI failing over',
    detail:
      'Requests for OpenAI models are routing to the backup backend while the primary recovers.',
    since: minsAgo(6),
    dismissible: true,
    href: '/traffic?verdict=rerouted',
  },
  {
    id: 'deg-warden-cache',
    kind: 'cache-stale',
    severity: 'info',
    title: 'Warden cache is stale',
    detail:
      'Guardrail decisions are served from cache; newly published rules may take a moment to take effect.',
    since: minsAgo(14),
    dismissible: true,
  },
]
