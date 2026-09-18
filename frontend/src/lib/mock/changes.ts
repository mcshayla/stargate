// Deterministic mock "what changed" events for the Overview timeline. Anchored
// to load time (like the receipt backlog) so a change reads as recent, and
// recency-biased so short presets still show a couple of ticks. Each event is
// curated to be *consequential* — something that could plausibly move traffic —
// and several are parked next to the traffic effects the mock stream and the
// "needs attention" list already show, so the correlation actually reads.
// Swap this module for the control-plane change/audit feed once the backend lands.

import type { ChangeEvent } from '@/lib/types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NOW = Date.now()
const at = (agoMs: number) => new Date(NOW - agoMs).toISOString()

// Newest → oldest. The recent cluster (route/budget) lines up with the rerouted
// and budget-pressure signals on the same screen; the older ones thin out toward
// the 30d edge so the widest preset shows history without crowding "just now".
export const changes: ChangeEvent[] = [
  {
    id: 'chg-1',
    ts: at(8 * MINUTE),
    kind: 'route',
    title: 'OpenAI failover engaged',
    detail: 'gpt-4o traffic rerouting to Anthropic after upstream latency spiked.',
    source: 'system',
    actor: 'gateway',
    href: '/traffic?verdict=rerouted',
  },
  {
    id: 'chg-2',
    ts: at(35 * MINUTE),
    kind: 'budget',
    title: 'research budget lowered to $0.20',
    detail: 'Enforcement set to block. Cap tightened from $0.35.',
    source: 'console',
    actor: 'j.bouder',
    href: '/traffic?q=research',
  },
  {
    id: 'chg-3',
    ts: at(2 * HOUR + 10 * MINUTE),
    kind: 'rule',
    title: 'us-ssn redaction promoted to enforce',
    detail: 'Moved from monitor to enforce after a clean replay against last week.',
    source: 'git',
    actor: 'security-policies@main',
    href: '/traffic?verdict=redacted',
  },
  {
    id: 'chg-4',
    ts: at(6 * HOUR),
    kind: 'backend',
    title: 'mistral-large-2411 backend adopted',
    detail: 'New OpenRouter backend reconciled from Git; now serving traffic.',
    source: 'git',
    actor: 'gateway-config@main',
    href: '/traffic?q=mistral',
  },
  {
    id: 'chg-5',
    ts: at(20 * HOUR),
    kind: 'key',
    title: 'helpdesk-agent key rotated',
    detail: 'sk-live-2e6a…f158 rotated; previous secret revoked.',
    source: 'console',
    actor: 'support-admin',
    href: '/traffic?q=helpdesk',
  },
  {
    id: 'chg-6',
    ts: at(3 * DAY),
    kind: 'deploy',
    title: 'Control plane rolled out v1.4.2',
    detail: 'Reconciler and Warden updated. No routing changes in this release.',
    source: 'console',
    actor: 'ci',
  },
  {
    id: 'chg-7',
    ts: at(9 * DAY),
    kind: 'model',
    title: 'gpt-4o input pricing updated',
    detail: 'Provider list price change reflected in cost metering.',
    source: 'git',
    actor: 'model-catalog@main',
    href: '/traffic?model=gpt-4o',
  },
]
