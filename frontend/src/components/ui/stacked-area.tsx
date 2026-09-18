import { useId, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

// Second nebari-design chart primitive (plan §8). A stacked-area chart for a
// composition over time — the verdict breakdown is the canonical use, drawn
// with the Q6 ramp. Same five constraints as Sparkline: no update animation,
// CSS-var (OKLCH) colors, a keyboard/table fallback (§7.7), a drill-to-receipts
// `onSelect` (§7.1), and Recharts-SVG as the known ceiling.

/** A time bucket: an `x` label plus one numeric value per series key. */
export type StackedAreaDatum = {
  x: string | number
  [seriesKey: string]: string | number
}

/** One stacked band — which key it reads, its label, and its themed color. */
export type StackedAreaSeries = {
  key: string
  label: string
  /** Fill/stroke color as a CSS value (a token like `var(--chart-1)`). */
  color: string
}

export interface StackedAreaProps {
  data: StackedAreaDatum[]
  series: StackedAreaSeries[]
  /** Accessible name for the composition (labels the image and the table). */
  label: string
  height?: number
  formatX?: (x: StackedAreaDatum['x']) => string
  formatY?: (y: number) => string
  /** Called when a bucket is activated — the drill-to-receipts seam. */
  onSelect?: (datum: StackedAreaDatum, index: number) => void
  /**
   * Called with a series key when its legend entry is activated — the
   * drill-by-slice seam (e.g. a verdict band → Traffic filtered to that
   * verdict). Makes the legend interactive; omit for a static legend.
   */
  onSelectSeries?: (key: string) => void
  className?: string
}

export function StackedArea({
  data,
  series,
  label,
  height = 160,
  formatX = String,
  formatY = String,
  onSelect,
  onSelectSeries,
  className,
}: StackedAreaProps) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  if (data.length === 0) {
    return (
      <div
        data-slot="stacked-area"
        className={cn(
          'flex items-center justify-center text-xs text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        No data
      </div>
    )
  }

  return (
    <div data-slot="stacked-area" className={cn('w-full', className)}>
      <div role="img" aria-label={label} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            onClick={(state) => {
              if (!onSelect) return
              const i = state?.activeTooltipIndex
              if (typeof i === 'number' && data[i]) onSelect(data[i], i)
            }}
          >
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stackId="stack"
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.85}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* A legend labels every band in text — the stack is never readable by
          color alone (§7.7). When `onSelectSeries` is set the entries become
          buttons that drill to that series' slice. */}
      <ul
        data-slot="stacked-area-legend"
        aria-label={`${label} legend`}
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1"
      >
        {series.map((s) => {
          const swatch = (
            <span
              data-swatch
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color }}
            />
          )
          return (
            <li key={s.key} className="flex items-center gap-1.5 text-xs">
              {onSelectSeries ? (
                <button
                  type="button"
                  onClick={() => onSelectSeries(s.key)}
                  className="flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {swatch}
                  {s.label}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {swatch}
                  {s.label}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((s) => !s)}
        className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {showTable ? 'Hide data table' : 'Show data table'}
      </button>

      <table
        id={tableId}
        hidden={!showTable}
        aria-label={label}
        className="mt-1 w-full text-xs tabular-nums"
      >
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="font-medium">
              Point
            </th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((datum, i) => (
            <tr key={`${datum.x}-${i}`} className="border-t border-border">
              <td>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(datum, i)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    {formatX(datum.x)}
                  </button>
                ) : (
                  formatX(datum.x)
                )}
              </td>
              {series.map((s) => (
                <td key={s.key} className="text-right font-mono">
                  {formatY(Number(datum[s.key] ?? 0))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
