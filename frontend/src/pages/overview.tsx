import { useMemo } from 'react'
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { ChangeTimeline } from '@/components/change-timeline'
import { Money } from '@/components/values'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Sparkline } from '@/components/ui/sparkline'
import { StackedArea } from '@/components/ui/stacked-area'
import { VERDICTS, verdictChartColor, verdictLabel } from '@/components/verdict-badge'
import { useTimeRange } from '@/lib/hooks/use-time-range'
import { formatClock, formatCount, formatDuration, formatRelative } from '@/lib/format'
import { toVerdictSeries, toVolumeSeries, windowReceipts } from '@/lib/series'
import { cn } from '@/lib/utils'
import { changes } from '@/lib/mock/changes'
import { attention, computeTotals, receipts } from '@/lib/mock/receipts'
import type { AttentionItem, ChangeEvent, Receipt } from '@/lib/types'

/** Percentage change from the prior equal-length window, rounded. */
function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

// Charts read epoch-ms x values (the series selectors keep them locale-free);
// the page owns display formatting.
const clockOf = (x: string | number) => formatClock(new Date(x).toISOString())

// Verdict stack drawn in canonical order with the shared verdict colors, so a
// verdict reads identically here, in a chip, and in the Traffic color-bar.
const VERDICT_SERIES = VERDICTS.map((v) => ({
  key: v,
  label: verdictLabel(v),
  color: verdictChartColor(v),
}))

// --- health strip -----------------------------------------------------------
const HEALTH = [
  { label: 'Gateway', state: 'ok' as const },
  { label: 'Control plane', state: 'ok' as const },
  { label: 'Warden', state: 'ok' as const },
  { label: 'OpenAI', state: 'degraded' as const },
  { label: 'Anthropic', state: 'ok' as const },
  { label: 'Local (vLLM)', state: 'ok' as const },
]

const STATE_DOT: Record<'ok' | 'degraded' | 'down', string> = {
  ok: 'bg-success-foreground',
  degraded: 'bg-warning-foreground',
  down: 'bg-destructive-foreground',
}

function HealthStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border px-4 py-2.5">
      {HEALTH.map((h) => (
        <span key={h.label} className="flex items-center gap-1.5 text-sm">
          <span className={cn('size-2 rounded-full', STATE_DOT[h.state])} />
          {h.label}
        </span>
      ))}
    </div>
  )
}

// --- metric -----------------------------------------------------------------
function Metric({
  label,
  value,
  delta,
  deltaLabel,
  good,
}: {
  label: string
  value: React.ReactNode
  delta: number
  deltaLabel: string
  good: boolean
}) {
  const Trend: LucideIcon = delta >= 0 ? TrendingUp : TrendingDown
  return (
    <Card>
      <CardContent className="p-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="mt-1 font-mono text-2xl tabular-nums">
          {value}
        </CardTitle>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-xs',
            good ? 'text-success-foreground' : 'text-warning-foreground',
          )}
        >
          <Trend className="size-3.5" />
          <span className="tabular-nums">
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// --- trends -----------------------------------------------------------------
function VolumeTrend({ rows, label }: { rows: Receipt[]; label: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <CardDescription>Request volume · {label}</CardDescription>
        <div className="mt-3">
          <Sparkline
            data={toVolumeSeries(rows, 24)}
            label={`Request volume over the ${label}`}
            formatX={clockOf}
            formatY={formatCount}
            height={72}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function VerdictTrend({ rows, label }: { rows: Receipt[]; label: string }) {
  const navigate = useNavigate()
  return (
    <Card>
      <CardContent className="p-4">
        <CardDescription>
          Verdicts · {label} — select a verdict to drill into Traffic
        </CardDescription>
        <div className="mt-3">
          <StackedArea
            data={toVerdictSeries(rows, 12)}
            series={VERDICT_SERIES}
            label={`Verdict composition over the ${label}`}
            formatX={clockOf}
            formatY={formatCount}
            height={120}
            onSelectSeries={(verdict) =>
              navigate(`/traffic?verdict=${encodeURIComponent(verdict)}`)
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}

// --- what changed -----------------------------------------------------------
// The differentiator (Flow A step 5): join a config/system change to its traffic
// effect. The rail shares the window with the volume trend above, so a tick sits
// under the curve it may have moved — correlation, deliberately not causation.
function WhatChanged({
  from,
  to,
  now,
  label,
}: {
  from: number
  to: number
  now: number
  label: string
}) {
  const navigate = useNavigate()
  const drill = (event: ChangeEvent) => {
    if (event.href) navigate(event.href)
  }
  return (
    <Card>
      <CardContent className="p-4">
        <CardDescription>
          What changed · {label} — a change lined up with a shift in traffic is a
          lead, not a cause
        </CardDescription>
        <div className="mt-3">
          <ChangeTimeline
            changes={changes}
            from={from}
            to={to}
            formatTime={(iso) => formatRelative(iso, now)}
            onSelect={drill}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// --- attention --------------------------------------------------------------
const SEVERITY: Record<
  AttentionItem['severity'],
  { icon: LucideIcon; className: string }
> = {
  critical: { icon: AlertTriangle, className: 'text-destructive-foreground' },
  warning: { icon: AlertTriangle, className: 'text-warning-foreground' },
  info: { icon: Info, className: 'text-info-foreground' },
}

function Attention() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
          Needs attention
        </div>
        <ul className="divide-y divide-border">
          {attention.map((item) => {
            const s = SEVERITY[item.severity]
            const Icon = s.icon
            return (
              <li key={item.id} className="flex gap-3 px-4 py-3">
                <Icon className={cn('mt-0.5 size-4 shrink-0', s.className)} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.detail}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

export function OverviewPage() {
  const { from, to, now, label } = useTimeRange()
  const windowed = useMemo(
    () => windowReceipts(receipts, { from, to }),
    [from, to],
  )
  const totals = useMemo(() => computeTotals(windowed), [windowed])
  // Compare against the immediately preceding window of the same length, so the
  // delta is a real "vs. prior period" rather than a decorative number.
  const prior = useMemo(
    () => computeTotals(windowReceipts(receipts, { from: from - (to - from), to: from })),
    [from, to],
  )
  const dRequests = pctDelta(totals.requests, prior.requests)
  const dSpend = pctDelta(totals.spendUsd, prior.spendUsd)
  const dBlocked = pctDelta(totals.blocked, prior.blocked)

  return (
    <AppShell
      title="Overview"
      description={`Health, spend, and traffic for the ${label}.`}
    >
      <div className="space-y-4 p-4">
        <HealthStrip />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Requests"
            value={formatCount(totals.requests)}
            delta={dRequests}
            deltaLabel="vs. prior period"
            good={dRequests >= 0}
          />
          <Metric
            label="Spend"
            value={<Money value={totals.spendUsd} />}
            delta={dSpend}
            deltaLabel="vs. prior period"
            good={dSpend <= 0}
          />
          <Metric
            label="Blocked"
            value={formatCount(totals.blocked)}
            delta={dBlocked}
            deltaLabel="vs. prior period"
            good={dBlocked <= 0}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <VolumeTrend rows={windowed} label={label} />
          <VerdictTrend rows={windowed} label={label} />
        </div>

        <WhatChanged from={from} to={to} now={now} label={label} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <CardDescription>At a glance</CardDescription>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Avg latency</dt>
                  <dd className="font-mono tabular-nums">
                    {formatDuration(totals.avgLatencyMs)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Redacted requests</dt>
                  <dd className="font-mono tabular-nums">
                    {formatCount(totals.redacted)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Blocked requests</dt>
                  <dd className="font-mono tabular-nums">
                    {formatCount(totals.blocked)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <Attention />
      </div>
    </AppShell>
  )
}
