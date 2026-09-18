import { cn } from '@/lib/utils'
import {
  formatDuration,
  formatTokens,
  formatUsd,
  formatUsdPrecise,
} from '@/lib/format'

// Numbers that can change render monospaced with tabular figures so columns
// stay aligned and digits don't jitter as the stream updates (spec §7.2).

export function Money({
  value,
  precise,
  className,
}: {
  value: number
  precise?: boolean
  className?: string
}) {
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {precise ? formatUsdPrecise(value) : formatUsd(value)}
    </span>
  )
}

export function TokenCount({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {formatTokens(value)}
    </span>
  )
}

export function Duration({
  ms,
  className,
}: {
  ms: number
  className?: string
}) {
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {formatDuration(ms)}
    </span>
  )
}
