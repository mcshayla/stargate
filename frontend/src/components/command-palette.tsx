import { Dialog } from '@base-ui/react/dialog'
import { CornerDownLeft, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildPaletteIndex, resolvePalette } from '@/lib/palette'
import type { PaletteResult } from '@/lib/palette'
import { receipts as allReceipts } from '@/lib/mock/receipts'
import type { Receipt } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The global ⌘K command palette (spec §7.4, Q8). Phase 1 is navigate +
 * jump-to-entity: go to a live surface, to a model's or key's traffic, or
 * straight to a receipt by typing its id or trace id. No actions yet.
 *
 * Controlled by the shell so the header ⌘K affordance and the keyboard shortcut
 * share one open state. The resolver ({@link resolvePalette}) owns matching and
 * ranking; this component owns the dialog, the roving keyboard selection, and
 * routing on select.
 */
export function CommandPalette({
  open,
  onOpenChange,
  receipts = allReceipts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receipts?: readonly Receipt[]
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const index = useMemo(() => buildPaletteIndex(receipts), [receipts])
  const results = useMemo(() => resolvePalette(query, index), [query, index])

  // Reset the query whenever the palette closes, so it always reopens clean —
  // done here on the state transition rather than in an effect.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setQuery('')
      onOpenChange(next)
    },
    [onOpenChange],
  )

  // A ⌘K / Ctrl+K anywhere toggles the palette. Registered once, globally.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, handleOpenChange])

  const select = useCallback(
    (result: PaletteResult | undefined) => {
      if (!result) return
      handleOpenChange(false)
      navigate(result.to)
    },
    [navigate, handleOpenChange],
  )

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (i + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (i - 1 + results.length) % results.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        select(results[active])
      }
    },
    [results, active, select],
  )

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-scrim data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-(--duration-base)" />
        <Dialog.Popup
          aria-label="Command palette"
          initialFocus={inputRef}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg outline-none data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-(--duration-base)"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Jump to a surface, a model, a key, or a receipt by id.
          </Dialog.Description>

          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              aria-activedescendant={
                results.length > 0 ? `palette-opt-${active}` : undefined
              }
              aria-controls="palette-listbox"
              aria-expanded
              autoComplete="off"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onChange={(e) => {
                setQuery(e.target.value)
                // New query re-ranks the list — return the highlight to the top.
                setActive(0)
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Jump to a surface, model, key, or receipt id…"
              role="combobox"
              spellCheck={false}
              type="text"
              value={query}
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          <ul
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
            id="palette-listbox"
            role="listbox"
          >
            {results.length === 0 ? (
              <li
                className="px-3 py-6 text-center text-sm text-muted-foreground"
                role="presentation"
              >
                No matches for “{query.trim()}”.
              </li>
            ) : (
              results.map((result, i) => {
                const prev = results[i - 1]
                const showHeader = !prev || prev.group !== result.group
                return (
                  <li key={result.id} role="presentation">
                    {showHeader && (
                      <p className="px-2 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {result.group}
                      </p>
                    )}
                    <button
                      aria-selected={i === active}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                        i === active
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground',
                      )}
                      id={`palette-opt-${i}`}
                      onClick={() => select(result)}
                      onMouseMove={() => setActive(i)}
                      role="option"
                      type="button"
                    >
                      <span className="min-w-0 flex-1 truncate">{result.label}</span>
                      {result.hint && (
                        <span className="shrink-0 truncate text-xs text-muted-foreground">
                          {result.hint}
                        </span>
                      )}
                      {i === active && (
                        <CornerDownLeft
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
