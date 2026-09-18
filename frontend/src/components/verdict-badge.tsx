import { Ban, Check, Scissors, ShieldAlert, Shuffle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Verdict } from '@/lib/types'

// Verdict styling lives here so the glyph + label + color stay in lockstep
// everywhere. Per the spec's a11y gate, verdict is never signalled by color
// alone — the icon and text label always travel with it.
// `chart` is the CSS-var color the chart primitives stack/stroke with — the same
// hue family as the badge/bar, so a verdict reads identically in a chart, a chip,
// and the Traffic color-bar (spec §8.2, Q6 ramp).
const VERDICT: Record<
  Verdict,
  { label: string; icon: LucideIcon; chip: string; bar: string; chart: string }
> = {
  allowed: { label: 'Allowed', icon: Check, chip: 'bg-success text-success-foreground', bar: 'bg-success-foreground', chart: 'var(--success-foreground)' },
  redacted: { label: 'Redacted', icon: ShieldAlert, chip: 'bg-warning text-warning-foreground', bar: 'bg-warning-foreground', chart: 'var(--warning-foreground)' },
  rerouted: { label: 'Rerouted', icon: Shuffle, chip: 'bg-info text-info-foreground', bar: 'bg-info-foreground', chart: 'var(--info-foreground)' },
  blocked: { label: 'Blocked', icon: Ban, chip: 'bg-destructive text-destructive-foreground', bar: 'bg-destructive-foreground', chart: 'var(--destructive-foreground)' },
  truncated: { label: 'Truncated', icon: Scissors, chip: 'bg-muted text-muted-foreground-strong', bar: 'bg-muted-foreground', chart: 'var(--muted-foreground)' },
}

/** Verdicts in canonical display order — allowed first (the 95% case). */
export const VERDICTS = Object.keys(VERDICT) as Verdict[]

export function verdictBarColor(verdict: Verdict): string {
  return VERDICT[verdict].bar
}

/** CSS-var color for a verdict in a chart (OKLCH token, never hardcoded). */
export function verdictChartColor(verdict: Verdict): string {
  return VERDICT[verdict].chart
}

/** Human label for a verdict — the display string used in legends/tables. */
export function verdictLabel(verdict: Verdict): string {
  return VERDICT[verdict].label
}

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: Verdict
  className?: string
}) {
  const v = VERDICT[verdict]
  const Icon = v.icon
  return (
    <span
      data-verdict={verdict}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        v.chip,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {v.label}
    </span>
  )
}
