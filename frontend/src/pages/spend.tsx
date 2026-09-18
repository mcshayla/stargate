import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { Money } from '@/components/values'
import { Badge } from '@/components/ui/badge'
import { BarSeries, type BarSeriesDatum } from '@/components/ui/bar-series'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { Sparkline } from '@/components/ui/sparkline'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { useTimeRange } from '@/lib/hooks/use-time-range'
import { formatClock, formatCount, formatUsdPrecise } from '@/lib/format'
import { toCostSeries, toSpendBars, windowReceipts } from '@/lib/series'
import { cn } from '@/lib/utils'
import {
  receipts,
  spendByModel,
  spendByProvider,
  spendByTeam,
} from '@/lib/mock/receipts'
import type { Receipt, SpendRow } from '@/lib/types'

const clockOf = (x: string | number) => formatClock(new Date(x).toISOString())

// A breakdown bar drills to Traffic filtered to that slice (spec §7.1 / Flow B).
// Model has a dedicated filter param; team/provider ride the free-text search,
// whose haystack already covers both.
function trafficHref(dim: (typeof DIMENSIONS)[number]['id'], label: string): string {
  const param = dim === 'model' ? 'model' : 'q'
  return `/traffic?${param}=${encodeURIComponent(label)}`
}

const DIMENSIONS = [
  { id: 'team', label: 'Team', select: spendByTeam },
  { id: 'model', label: 'Model', select: spendByModel },
  { id: 'provider', label: 'Provider', select: spendByProvider },
] as const

const ENFORCEMENT_VARIANT: Record<
  NonNullable<SpendRow['enforcement']>,
  'secondary' | 'outline' | 'destructive'
> = {
  warn: 'outline',
  throttle: 'secondary',
  block: 'destructive',
}

function BudgetCell({ row }: { row: SpendRow }) {
  if (row.budgetUsd == null) {
    return <span className="text-muted-foreground">—</span>
  }
  const pct = Math.min(100, (row.costUsd / row.budgetUsd) * 100)
  const over = pct >= 90
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {pct.toFixed(0)}% of <Money value={row.budgetUsd} />
        </span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full',
              over ? 'bg-destructive-foreground' : 'bg-chart-1',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {row.enforcement && (
        <Badge variant={ENFORCEMENT_VARIANT[row.enforcement]}>
          {row.enforcement}
        </Badge>
      )}
    </div>
  )
}

function BreakdownTable({ rows }: { rows: readonly SpendRow[] }) {
  return (
    <Table aria-label="Spend breakdown">
      <TableHeader>
        <TableRow>
          <TableHead>Scope</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Budget</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.scope}>
            <TableCell className="font-mono text-xs">{row.scope}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
              {formatCount(row.requests)}
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.costUsd} />
            </TableCell>
            <TableCell className="text-right">
              <BudgetCell row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SpendTrend({ rows, label }: { rows: Receipt[]; label: string }) {
  // Naive projection: current window's spend rate held flat for one more window.
  const spend = rows.reduce((sum, r) => sum + r.costUsd, 0)
  const projection = spend * 1.9
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between">
          <CardDescription>Spend · {label}</CardDescription>
          <span className="text-xs text-muted-foreground">
            Projected to period end{' '}
            <Money value={projection} className="text-foreground" />
          </span>
        </div>
        <div className="mt-3">
          <Sparkline
            data={toCostSeries(rows, 24)}
            label={`Spend over the ${label}`}
            formatX={clockOf}
            formatY={formatUsdPrecise}
            height={120}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Projection assumes the current rate holds flat — not a forecast.
        </p>
      </CardContent>
    </Card>
  )
}

export function SpendPage() {
  const navigate = useNavigate()
  const { from, to, label } = useTimeRange()
  const windowed = useMemo(
    () => windowReceipts(receipts, { from, to }),
    [from, to],
  )
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]['id']>('team')
  const active = DIMENSIONS.find((d) => d.id === dim) ?? DIMENSIONS[0]
  const rows = useMemo(() => active.select(windowed), [active, windowed])
  const drill = (datum: BarSeriesDatum) => navigate(trafficHref(dim, datum.label))

  return (
    <AppShell
      title="Spend"
      description="Cost attribution and budget consumption. Cost always travels with the request."
    >
      <div className="p-4">
        <Tabs defaultValue="breakdown">
          <TabsList>
            <TabsTab value="breakdown">Breakdown</TabsTab>
            <TabsTab value="trend">Trend</TabsTab>
            <TabsIndicator />
          </TabsList>

          <TabsPanel value="breakdown" className="pt-4">
            <div className="mb-3 flex items-center gap-1">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDim(d.id)}
                  aria-pressed={d.id === dim}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    d.id === dim
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  By {d.label}
                </button>
              ))}
            </div>
            <Card className="mb-4">
              <CardContent className="p-4">
                <CardDescription className="mb-3">
                  Cost by {active.label.toLowerCase()} · select a bar to drill into Traffic
                </CardDescription>
                <BarSeries
                  data={toSpendBars(rows)}
                  label={`Spend by ${active.label.toLowerCase()}`}
                  formatValue={formatUsdPrecise}
                  onSelect={drill}
                  height={180}
                />
              </CardContent>
            </Card>
            <BreakdownTable rows={rows} />
          </TabsPanel>

          <TabsPanel value="trend" className="pt-4">
            <SpendTrend rows={windowed} label={label} />
          </TabsPanel>
        </Tabs>
      </div>
    </AppShell>
  )
}
