import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { DEFAULT_PRESET, type PresetId } from '@/lib/time-range'
import { useTimeRange } from '@/lib/hooks/use-time-range'
import { cn } from '@/lib/utils'

// The shared time-range control that sits in the app header. It reads and
// writes the URL-canonical window (via useTimeRange), so it is the single place
// the Observe surfaces are scoped from. Two modes, made visible so the console
// never lies about whether it is live: a live relative preset (pulsing "Live"),
// or a pinned absolute span (auto-refresh off, shown as "Pinned").

/** Format an epoch ms into the value a <input type="datetime-local"> expects. */
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TimeRange() {
  const { selection, live, from, to, label, presets, setPreset, pin } =
    useTimeRange()
  const activePreset = selection.kind === 'relative' ? selection.preset : null

  // Remember the last live preset so "Go live" resumes the span the user was
  // watching before they pinned — not an arbitrary default. Adjusted during
  // render (the recommended pattern for state derived from changing props)
  // rather than in an effect.
  const [lastPreset, setLastPreset] = useState<PresetId>(DEFAULT_PRESET)
  if (activePreset && activePreset !== lastPreset) {
    setLastPreset(activePreset)
  }

  const [customOpen, setCustomOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center rounded-md border border-border p-0.5"
        role="group"
        aria-label="Time range"
      >
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={activePreset === p.id}
            onClick={() => setPreset(p.id)}
            className={cn(
              'rounded px-2 py-0.5 text-xs font-medium tabular-nums transition-colors',
              activePreset === p.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
        <CustomPicker
          open={customOpen}
          onOpenChange={setCustomOpen}
          pinned={selection.kind === 'absolute'}
          from={from}
          to={to}
          onPin={(f, t) => {
            pin(f, t)
            setCustomOpen(false)
          }}
        />
      </div>

      {live ? (
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title="Window follows now and refreshes automatically"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-foreground opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success-foreground" />
          </span>
          Live
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="tabular-nums" title="Auto-refresh paused">
            Pinned&nbsp;·&nbsp;{label}
          </span>
          <button
            type="button"
            onClick={() => setPreset(lastPreset)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-foreground hover:bg-muted"
          >
            <Radio className="size-3" />
            Go live
          </button>
        </span>
      )}
    </div>
  )
}

function CustomPicker({
  open,
  onOpenChange,
  pinned,
  from,
  to,
  onPin,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pinned: boolean
  from: number
  to: number
  onPin: (from: number, to: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // Dismiss on outside click / Escape, like a lightweight popover.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-pressed={pinned}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'rounded px-2 py-0.5 text-xs font-medium transition-colors',
          pinned
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Custom
      </button>

      {/* Mount the form only while open so it seeds fresh from the current
          window each time — no effect needed to sync the inputs. */}
      {open && <CustomForm from={from} to={to} onPin={onPin} />}
    </div>
  )
}

function CustomForm({
  from,
  to,
  onPin,
}: {
  from: number
  to: number
  onPin: (from: number, to: number) => void
}) {
  const [fromValue, setFromValue] = useState(() => toLocalInput(from))
  const [toValue, setToValue] = useState(() => toLocalInput(to))

  const fromMs = Date.parse(fromValue)
  const toMs = Date.parse(toValue)
  const valid = !Number.isNaN(fromMs) && !Number.isNaN(toMs) && fromMs < toMs

  return (
    <div
      role="dialog"
      aria-label="Custom time range"
      className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md"
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <input
            type="datetime-local"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <input
            type="datetime-local"
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground tabular-nums"
          />
        </label>
        {!valid && (fromValue || toValue) && (
          <p className="text-[11px] text-danger-foreground">
            Pick a start before the end.
          </p>
        )}
        <button
          type="button"
          disabled={!valid}
          onClick={() => valid && onPin(fromMs, toMs)}
          className="mt-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Apply range
        </button>
      </div>
    </div>
  )
}
