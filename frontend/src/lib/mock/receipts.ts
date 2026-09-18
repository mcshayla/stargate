// Deterministic mock traffic for the Phase 1 read-only surfaces. Seeded so the
// dataset is stable across reloads; anchored to load time so the stream reads
// as recent. Swap this module for the receipt-query API once the backend lands.

import type {
  AttentionItem,
  Receipt,
  SpendRow,
  TokenUsage,
  TraceStep,
  Verdict,
} from '@/lib/types'

// --- seeded PRNG (mulberry32) -----------------------------------------------
function makeRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = makeRng(0x57a26a7e)
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]
const between = (lo: number, hi: number) => lo + rng() * (hi - lo)

// --- reference data ---------------------------------------------------------
const MODELS = [
  { requested: 'gpt-4o', resolved: 'gpt-4o-2024-08-06', provider: 'OpenAI', inCost: 2.5, outCost: 10 },
  { requested: 'claude-opus-4-8', resolved: 'claude-opus-4-8', provider: 'Anthropic', inCost: 15, outCost: 75 },
  { requested: 'claude-sonnet-4-6', resolved: 'claude-sonnet-4-6', provider: 'Anthropic', inCost: 3, outCost: 15 },
  { requested: 'llama-3.3-70b', resolved: 'llama-3.3-70b-instruct', provider: 'Local (vLLM)', inCost: 0, outCost: 0 },
  { requested: 'gemini-2.5-pro', resolved: 'gemini-2.5-pro', provider: 'Google (Vertex)', inCost: 1.25, outCost: 5 },
  { requested: 'mistral-large', resolved: 'mistral-large-2411', provider: 'OpenRouter', inCost: 2, outCost: 6 },
] as const

const KEYS = [
  { key: 'sk-live-8f2a…c091', team: 'platform', project: 'agent-console' },
  { key: 'sk-live-3b7d…a4e2', team: 'research', project: 'rag-eval' },
  { key: 'sk-live-9c1f…7b30', team: 'finance', project: 'reporting-bot' },
  { key: 'sk-live-2e6a…f158', team: 'support', project: 'helpdesk-agent' },
  { key: 'sk-live-a04c…dd21', team: 'platform', project: 'ci-summarizer' },
] as const

const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1'] as const

// Weighted so the stream reads like real traffic: mostly allowed, a few blocks.
const VERDICT_WEIGHTS: [Verdict, number][] = [
  ['allowed', 0.72],
  ['redacted', 0.12],
  ['rerouted', 0.08],
  ['blocked', 0.05],
  ['truncated', 0.03],
]

function rollVerdict(): Verdict {
  const r = rng()
  let acc = 0
  for (const [v, w] of VERDICT_WEIGHTS) {
    acc += w
    if (r <= acc) return v
  }
  return 'allowed'
}

const REDACTION_TYPES = ['email', 'credit-card', 'us-ssn', 'api-key', 'phone']

function buildTrace(
  verdict: Verdict,
  m: (typeof MODELS)[number],
  redactions: Receipt['redactions'],
): TraceStep[] {
  const steps: TraceStep[] = [
    { stage: 'identity', label: 'Identity resolved', outcome: 'key authenticated', durationMs: between(0.4, 1.6) },
    { stage: 'budget', label: 'Budget check', outcome: 'within cap', durationMs: between(0.3, 1.1) },
  ]
  if (verdict === 'redacted') {
    const total = redactions.reduce((n, r) => n + r.count, 0)
    steps.push({ stage: 'rules', label: 'Outbound policy', outcome: `${total} span(s) redacted`, durationMs: between(1.5, 4), notable: true })
  } else if (verdict === 'blocked') {
    steps.push({ stage: 'rules', label: 'Outbound policy', outcome: 'blocked: sensitive data', durationMs: between(1.2, 3), notable: true })
    return steps
  } else {
    steps.push({ stage: 'rules', label: 'Outbound policy', outcome: 'no match', durationMs: between(0.6, 2) })
  }
  steps.push(
    verdict === 'rerouted'
      ? { stage: 'route', label: 'Route resolved', outcome: `failover → ${m.resolved}`, durationMs: between(0.5, 1.8), notable: true }
      : { stage: 'route', label: 'Route resolved', outcome: m.resolved, durationMs: between(0.4, 1.4) },
  )
  steps.push({ stage: 'upstream', label: 'Upstream call', outcome: `${m.provider} 200`, durationMs: between(180, 900) })
  steps.push(
    verdict === 'truncated'
      ? { stage: 'response', label: 'Response inspection', outcome: 'truncated at max_tokens', durationMs: between(1, 3), notable: true }
      : { stage: 'response', label: 'Response inspection', outcome: 'clean', durationMs: between(0.8, 2.4) },
  )
  return steps
}

// `seq` drives the receipt id (stable, monotonic); `tsMillis` its timestamp.
// Decoupling the two lets the backlog spread receipts back in time while the
// live minter stamps them at "now" — both from the same generator.
function makeReceipt(seq: number, tsMillis: number): Receipt {
  const m = pick(MODELS)
  const k = pick(KEYS)
  const verdict = rollVerdict()
  const streaming = rng() > 0.4

  const inputTok = Math.round(between(120, 6000))
  const outputTok = verdict === 'blocked' ? 0 : Math.round(between(40, 1400))
  const tokens: TokenUsage = {
    input: inputTok,
    cached: Math.round(inputTok * between(0, 0.5)),
    output: outputTok,
    reasoning: m.requested.startsWith('claude') && rng() > 0.6 ? Math.round(between(50, 600)) : 0,
  }

  const costUsd =
    (tokens.input / 1_000_000) * m.inCost + (tokens.output / 1_000_000) * m.outCost

  const redactions =
    verdict === 'redacted' || verdict === 'blocked'
      ? [{ type: pick(REDACTION_TYPES), count: Math.round(between(1, 4)) }]
      : []

  const durationMs = verdict === 'blocked' ? between(3, 12) : between(220, 1800)

  const ts = new Date(tsMillis).toISOString()
  const id = `rcpt_${(0x1000 + seq).toString(16)}`

  return {
    id,
    traceId: `${id}-trace`,
    ts,
    durationMs,
    ttftMs: streaming && verdict !== 'blocked' ? between(120, 480) : undefined,
    key: k.key,
    team: k.team,
    project: k.project,
    modelRequested: m.requested,
    modelResolved: verdict === 'rerouted' ? pick(MODELS).resolved : m.resolved,
    provider: m.provider,
    backend: `${m.provider.toLowerCase().split(' ')[0]}-primary`,
    region: pick(REGIONS),
    verdict,
    status: verdict === 'blocked' ? 'error' : 'success',
    statusCode: verdict === 'blocked' ? 403 : 200,
    costUsd,
    tokens,
    redactions,
    trace: buildTrace(verdict, m, redactions),
  }
}

const NOW = Date.now()
const BACKLOG = 360
const SPAN_MS = 30 * 24 * 60 * 60 * 1000 // 30 days — the widest preset
const RECENCY_EXP = 3 // higher = denser near "now"

// Spread the backlog back over ~30 days with a power-law bias toward the
// present: the last few minutes are dense (a live token dashboard lives on
// "just now"), older days sparse. This is what lets the shared time-range
// control actually do something — each preset (1h < 6h < 24h < 7d < 30d)
// reveals a meaningfully larger slice instead of the same handful of rows.
// Sorted newest-first so the stream seed and Traffic display stay honest.
export const receipts: Receipt[] = Array.from({ length: BACKLOG }, (_, i) => {
  const frac = i / BACKLOG
  // Shave 0–12% off the age (never extend) so timestamps wobble but the oldest
  // rows stay inside the 30d window — every row reachable by the widest preset.
  const jitter = 1 - between(0, 0.12) * frac
  const ageMs = Math.min(Math.pow(frac, RECENCY_EXP) * SPAN_MS * jitter, SPAN_MS)
  return makeReceipt(i, NOW - ageMs)
}).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

// Live minter: a fresh receipt stamped at the current instant, with an id that
// continues past the backlog so it never collides. Stands in for the
// receipt-query API's "rows since cursor" until the backend lands — swap the
// caller (useLiveStream) to SSE/WebSocket without touching this shape.
let liveSeq = BACKLOG
export function mintReceipt(): Receipt {
  return makeReceipt(liveSeq++, Date.now())
}

// --- derived views ----------------------------------------------------------
// All derived over a passed-in slice (not the module-level backlog) so every
// Observe surface can hand in the time-windowed receipts and get numbers that
// match the range shown in the header.

export type Totals = {
  requests: number
  spendUsd: number
  blocked: number
  redacted: number
  avgLatencyMs: number
}

export function computeTotals(rows: readonly Receipt[]): Totals {
  return {
    requests: rows.length,
    spendUsd: rows.reduce((s, r) => s + r.costUsd, 0),
    blocked: rows.filter((r) => r.verdict === 'blocked').length,
    redacted: rows.filter((r) => r.verdict === 'redacted').length,
    avgLatencyMs: rows.length
      ? rows.reduce((s, r) => s + r.durationMs, 0) / rows.length
      : 0,
  }
}

function groupSpend(
  rows: readonly Receipt[],
  by: (r: Receipt) => string,
): SpendRow[] {
  const map = new Map<string, SpendRow>()
  for (const r of rows) {
    const scope = by(r)
    const row = map.get(scope) ?? { scope, requests: 0, costUsd: 0 }
    row.requests += 1
    row.costUsd += r.costUsd
    map.set(scope, row)
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd)
}

// Budgets attached to a couple of teams so budget rows show enforcement.
const TEAM_BUDGETS: Record<string, { cap: number; enforcement: SpendRow['enforcement'] }> = {
  platform: { cap: 0.5, enforcement: 'throttle' },
  research: { cap: 0.2, enforcement: 'block' },
  finance: { cap: 0.1, enforcement: 'warn' },
}

export function spendByTeam(rows: readonly Receipt[]): SpendRow[] {
  return groupSpend(rows, (r) => r.team).map((row) => {
    const b = TEAM_BUDGETS[row.scope]
    return b ? { ...row, budgetUsd: b.cap, enforcement: b.enforcement } : row
  })
}

export function spendByModel(rows: readonly Receipt[]): SpendRow[] {
  return groupSpend(rows, (r) => r.modelRequested)
}

export function spendByProvider(rows: readonly Receipt[]): SpendRow[] {
  return groupSpend(rows, (r) => r.provider)
}

export const attention: AttentionItem[] = [
  {
    id: 'att-1',
    severity: 'critical',
    title: 'research team at 94% of budget',
    detail: 'Projected to exceed the $0.20 cap before period end. Enforcement: block.',
  },
  {
    id: 'att-2',
    severity: 'warning',
    title: 'OpenAI failover fired 3× in the last 25m',
    detail: 'Requests rerouted to Anthropic. Upstream latency spiked above threshold.',
  },
  {
    id: 'att-3',
    severity: 'warning',
    title: 'us-ssn redaction rule firing above baseline',
    detail: 'helpdesk-agent key accounts for most matches. Review recent prompts.',
  },
  {
    id: 'att-4',
    severity: 'info',
    title: 'New backend adopted from Git',
    detail: 'mistral-large-2411 via OpenRouter now serving traffic.',
  },
]
