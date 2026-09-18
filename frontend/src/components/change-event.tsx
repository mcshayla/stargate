import { Boxes, KeyRound, Rocket, Route, Server, Shield, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChangeKind, ChangeSource } from '@/lib/types'

// Styling for change events lives here so the glyph, label, and source chip stay
// in lockstep everywhere the "what changed" timeline is drawn. Deliberately
// near-monochrome: per the design language, color encodes *state*, and a config
// change isn't a state that needs a hue. Kind identity is carried by the glyph +
// text label (never color alone, per the a11y gate); the source chip is the one
// place we lean on a semantic tint, because provenance *is* a meaningful state.

const KIND: Record<ChangeKind, { label: string; icon: LucideIcon }> = {
  route: { label: 'Route', icon: Route },
  backend: { label: 'Backend', icon: Server },
  rule: { label: 'Rule', icon: Shield },
  budget: { label: 'Budget', icon: Wallet },
  model: { label: 'Model', icon: Boxes },
  deploy: { label: 'Deploy', icon: Rocket },
  key: { label: 'Key', icon: KeyRound },
}

/** Change kinds in a stable order — used anywhere we enumerate them. */
export const CHANGE_KINDS = Object.keys(KIND) as ChangeKind[]

export function changeKindLabel(kind: ChangeKind): string {
  return KIND[kind].label
}

export function changeKindIcon(kind: ChangeKind): LucideIcon {
  return KIND[kind].icon
}

/** The kind's glyph — labelled by the surrounding text, so hidden from a11y. */
export function ChangeKindIcon({
  kind,
  className,
}: {
  kind: ChangeKind
  className?: string
}) {
  const Icon = KIND[kind].icon
  return <Icon className={cn('size-3.5', className)} aria-hidden />
}

const SOURCE: Record<ChangeSource, { label: string; chip: string }> = {
  git: { label: 'Git', chip: 'bg-info text-info-foreground' },
  console: { label: 'Console', chip: 'bg-muted text-muted-foreground-strong' },
  system: { label: 'System', chip: 'bg-warning text-warning-foreground' },
}

export function changeSourceLabel(source: ChangeSource): string {
  return SOURCE[source].label
}

/** Provenance chip — Git-owned vs authored-in-console vs system-detected. */
export function ChangeSourceBadge({
  source,
  className,
}: {
  source: ChangeSource
  className?: string
}) {
  const s = SOURCE[source]
  return (
    <span
      data-source={source}
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
        s.chip,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
