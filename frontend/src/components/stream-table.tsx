import { ArrowUp } from 'lucide-react'
import { type ReactNode, useCallback, useRef } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type StreamColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Classes for both the header cell and the body cell (width, alignment). */
  className?: string
}

type StreamTableProps<T> = {
  ariaLabel: string
  columns: StreamColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  /** Human label for a row, used to name its "open receipt" action. */
  getRowLabel: (row: T) => string
  /** Ids currently animating in — get the entry tint. */
  newIds: ReadonlySet<string>
  onActivate: (row: T) => void
  /** Row whose receipt is open, highlighted so the drawer has an anchor. */
  activeRowId?: string | null
  /** Count behind the "N new" pill; 0 hides it. */
  pendingCount: number
  onFlush: () => void
  /**
   * Fires as the user starts or stops interacting with the table (hover or
   * keyboard focus within). The page freezes the stream while interacting so
   * rows never shift under the cursor and focus is never stolen.
   */
  onInteractingChange: (interacting: boolean) => void
  /** Shown in place of rows when there are none (empty / filtered-empty). */
  emptyState?: ReactNode
  className?: string
}

/**
 * The live request stream (spec §8 StreamTable). A vertical-scrolling viewport
 * with a sticky header; rows top-insert with a batched entry tint. Hovering or
 * focusing the table reports interaction so the caller can pause insertion, and
 * queued rows surface through a "N new" pill rather than jumping in — the "live
 * but calm" decision (Q3). Distinct from the paginated {@link DataTable}: a
 * stream is a moving window, not a paged archive.
 */
export function StreamTable<T>({
  ariaLabel,
  columns,
  rows,
  getRowId,
  getRowLabel,
  newIds,
  onActivate,
  activeRowId,
  pendingCount,
  onFlush,
  onInteractingChange,
  emptyState,
  className,
}: StreamTableProps<T>) {
  // Hover and keyboard-focus each independently hold the table "interacting";
  // it's only idle once both are false, so tabbing through rows keeps the
  // stream frozen even with the mouse elsewhere.
  const interacting = useRef({ hover: false, focus: false })
  const emit = useCallback(() => {
    onInteractingChange(interacting.current.hover || interacting.current.focus)
  }, [onInteractingChange])

  return (
    <div className={cn('relative', className)}>
      {pendingCount > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-12 z-20 flex justify-center">
          <button
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium shadow-sm motion-safe:animate-slide-down-fade hover:bg-muted"
            onClick={onFlush}
            type="button"
          >
            <ArrowUp className="size-3.5" aria-hidden />
            {pendingCount} new {pendingCount === 1 ? 'request' : 'requests'}
          </button>
        </div>
      ) : null}

      <Table
        aria-label={ariaLabel}
        scrollContainerClassName="max-h-[calc(100svh-13.5rem)] overflow-y-auto"
        scrollContainerProps={{
          onMouseEnter: () => {
            interacting.current.hover = true
            emit()
          },
          onMouseLeave: () => {
            interacting.current.hover = false
            emit()
          },
          onFocus: () => {
            interacting.current.focus = true
            emit()
          },
          onBlur: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              interacting.current.focus = false
              emit()
            }
          },
        }}
      >
        <TableHeader className="sticky top-0 z-10 shadow-[0_1px_0_0_var(--color-border)]">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead className={cn('px-3', col.className)} key={col.id} scope="col">
                {col.header}
              </TableHead>
            ))}
            <TableHead className="w-16 px-3" scope="col">
              <span className="sr-only">Open receipt</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell className="h-auto p-0" colSpan={columns.length + 1}>
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const id = getRowId(row)
              return (
                <TableRow
                  className={cn(
                    'cursor-pointer',
                    newIds.has(id) &&
                      'motion-safe:[animation:nebari-row-enter_150ms_var(--ease-emphasized),nebari-row-tint_1100ms_var(--ease-standard)]',
                  )}
                  data-state={activeRowId === id ? 'selected' : undefined}
                  key={id}
                  onClick={() => onActivate(row)}
                >
                  {columns.map((col) => (
                    <TableCell
                      className={cn('h-10 px-3 py-2', col.className)}
                      key={col.id}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                  <TableCell className="h-10 px-3 py-2 text-right">
                    <button
                      aria-label={`Open receipt for ${getRowLabel(row)}`}
                      className="rounded px-2 py-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      // The row already handles pointer clicks; keep the button
                      // as the keyboard/AT target without double-firing.
                      onClick={(event) => {
                        event.stopPropagation()
                        onActivate(row)
                      }}
                      type="button"
                    >
                      Trace →
                    </button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
