import { useId, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

// Third nebari-design chart primitive (plan §8). A categorical bar chart for a
// breakdown — spend by team/model/provider is the canonical use. Same five
// constraints as the other primitives: no update animation, a CSS-var (OKLCH)
// color, a keyboard/table fallback (§7.7), a drill-to-receipts `onSelect`
// (§7.1), and Recharts-SVG as the known ceiling.

/** One bar: a category label and its numeric value. */
export type BarSeriesDatum = {
  label: string
  value: number
}

export interface BarSeriesProps {
  data: BarSeriesDatum[]
  /** Accessible name for the breakdown (labels the image and the table). */
  label: string
  /** Bar color as a CSS value (a token like `var(--chart-1)`). */
  color?: string
  height?: number
  /** Formats a bar's value for the table fallback (defaults to `String`). */
  formatValue?: (value: number) => string
  /** Called when a bar is activated — the drill-to-receipts seam. */
  onSelect?: (datum: BarSeriesDatum, index: number) => void
  className?: string
}

export function BarSeries({
  data,
  label,
  color = 'var(--chart-1)',
  height = 160,
  formatValue = String,
  onSelect,
  className,
}: BarSeriesProps) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  if (data.length === 0) {
    return (
      <div
        data-slot="bar-series"
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
    <div data-slot="bar-series" className={cn('w-full', className)}>
      <div role="img" aria-label={label} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            onClick={(state) => {
              if (!onSelect) return
              const i = state?.activeTooltipIndex
              if (typeof i === 'number' && data[i]) onSelect(data[i], i)
            }}
          >
            <Bar dataKey="value" fill={color} isAnimationActive={false} />
          </BarChart>
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
              Category
            </th>
            <th scope="col" className="text-right font-medium">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum, i) => (
            <tr key={`${datum.label}-${i}`} className="border-t border-border">
              <td>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(datum, i)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    {datum.label}
                  </button>
                ) : (
                  datum.label
                )}
              </td>
              <td className="text-right font-mono">{formatValue(datum.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
