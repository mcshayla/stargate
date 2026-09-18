import { useId, useState } from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

// The first nebari-design chart primitive (plan §8). A calm, dependency-light
// trend line for a single metric. Five constraints ride on this component:
//   1. Live but calm — `isAnimationActive={false}`, so a poll tick redraws
//      without twitching (Q3 / spec §7.1).
//   2. OKLCH theming — the stroke is a CSS-var token (`--chart-1` by default),
//      never a hardcoded hex, so light/dark and the design ramps flow through.
//   3. Keyboard/table fallback — every chart ships a toggle-able <table>
//      equivalent so the trend is legible without the SVG (§7.7).
//   4. Drill to receipts — activating a point calls `onSelect` so callers can
//      route to Traffic filtered to that slice (§7.1).
//   5. Known ceiling — Recharts is SVG; fine for P1. Swap internals to uPlot
//      only if a high-frequency live sparkline ever strains.

export type SparklinePoint = {
  x: string | number
  y: number
}

export interface SparklineProps {
  /** The series to plot, oldest → newest. */
  data: SparklinePoint[]
  /**
   * Accessible name for the metric (e.g. "Requests per minute"). Labels the
   * chart image and its table fallback — required, never decorative.
   */
  label: string
  /** Stroke color as a CSS value; defaults to the `--chart-1` token. */
  color?: string
  /** Chart height in px. Width always fills the container. */
  height?: number
  /** Formats an x value for the table fallback (defaults to `String`). */
  formatX?: (x: SparklinePoint['x']) => string
  /** Formats a y value for the table fallback (defaults to `String`). */
  formatY?: (y: number) => string
  /** Called when a point is activated — the drill-to-receipts seam. */
  onSelect?: (point: SparklinePoint, index: number) => void
  className?: string
}

export function Sparkline({
  data,
  label,
  color = 'var(--chart-1)',
  height = 48,
  formatX = String,
  formatY = String,
  onSelect,
  className,
}: SparklineProps) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  // An empty series must read as "nothing here yet", never as a broken axis.
  if (data.length === 0) {
    return (
      <div
        data-slot="sparkline"
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
    <div data-slot="sparkline" className={cn('w-full', className)}>
      {/* The SVG is a labeled image; the table below carries the detail for
          assistive tech, so the chart itself stays a single summary node. */}
      <div role="img" aria-label={label} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
            onClick={(state) => {
              if (!onSelect) return
              const i = state?.activeTooltipIndex
              if (typeof i === 'number' && data[i]) onSelect(data[i], i)
            }}
          >
            <Line
              type="monotone"
              dataKey="y"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

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
            <th scope="col" className="text-right font-medium">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, i) => (
            <tr key={`${point.x}-${i}`} className="border-t border-border">
              <td>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(point, i)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    {formatX(point.x)}
                  </button>
                ) : (
                  formatX(point.x)
                )}
              </td>
              <td className="text-right font-mono">{formatY(point.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
